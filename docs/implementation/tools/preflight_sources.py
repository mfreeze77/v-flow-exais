#!/usr/bin/env python3
"""Read-only snapshot/folder checker for the supplied ArchFrame implementation plan.
No extraction, installs, source writes, Git commands or network requests are performed.
Python 3.10+. Raw source bytes and entry types are compared, not executable modes.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import stat
import sys
import zipfile

MAX_FILES = 100_000
MAX_TOTAL = 2 * 1024**3
MAX_FILE = 512 * 1024**2
ADMIN_NAMES = {'.git', 'node_modules', '.DS_Store', '__MACOSX'}
SENTINELS = {'archify': ('archify/package.json', 'archify/schemas/architecture.schema.json'),
             'hyperframes': ('package.json', 'packages/producer/package.json', 'packages/studio/src/App.tsx')}

class PreflightError(Exception):
    """Input cannot be safely or unambiguously inspected."""

def sha_stream(stream) -> tuple[str, int]:
    h = hashlib.sha256(); size = 0
    for chunk in iter(lambda: stream.read(1024 * 1024), b''):
        size += len(chunk)
        if size > MAX_FILE:
            raise PreflightError('File exceeds inspection limit')
        h.update(chunk)
    return h.hexdigest(), size

def safe_name(name: str) -> str:
    if not name or '\\' in name or '\x00' in name:
        raise PreflightError(f'Unsafe archive entry name: {name!r}')
    p = PurePosixPath(name)
    if p.is_absolute() or '..' in p.parts or (p.parts and ':' in p.parts[0]):
        raise PreflightError(f'Escaping/absolute archive entry: {name!r}')
    return p.as_posix()

def record(path: str, kind: str, digest: str, size: int) -> dict:
    return {'path': path, 'kind': kind, 'sha256': digest, 'size': size}

def scan_zip(path: Path, repository: str) -> dict:
    with zipfile.ZipFile(path) as z:
        infos = [i for i in z.infolist() if not i.is_dir()]
        if len(infos) > MAX_FILES or sum(i.file_size for i in infos) > MAX_TOTAL:
            raise PreflightError('Archive exceeds inspection limits')
        names = [safe_name(i.filename) for i in infos]
        if len(names) != len(set(names)):
            raise PreflightError('Duplicate normalized archive entries')
        # Permit either unwrapped sources or one common download wrapper directory.
        sentinels = SENTINELS[repository]
        name_set = set(names)
        if all(s in name_set for s in sentinels):
            prefix = ''
        else:
            roots = {n.split('/', 1)[0] for n in names if '/' in n}
            matches = [r + '/' for r in roots if all(r + '/' + s in name_set for s in sentinels)]
            if len(matches) != 1:
                raise PreflightError(f'Cannot identify exactly one {repository} source root')
            prefix = matches[0]
        entries = []; excluded = []; total = 0
        for info, name in zip(infos, names):
            if prefix and not name.startswith(prefix):
                raise PreflightError(f'Entry outside identified source root: {name}')
            rel = name[len(prefix):]
            if any(x in ADMIN_NAMES for x in PurePosixPath(rel).parts):
                excluded.append(rel); continue
            if info.file_size > MAX_FILE:
                raise PreflightError(f'Entry exceeds file limit: {rel}')
            if info.flag_bits & 1:
                raise PreflightError(f'Encrypted entry unsupported: {rel}')
            with z.open(info) as stream:
                digest, size = sha_stream(stream)
            total += size
            if total > MAX_TOTAL: raise PreflightError('Actual decoded bytes exceed total limit')
            kind = 'symlink' if stat.S_ISLNK(info.external_attr >> 16) else 'file'
            entries.append(record(rel, kind, digest, size))
        return {'input_type': 'zip', 'resolved_root': prefix.rstrip('/'), 'entries': entries,
                'excluded_admin_entries': excluded,
                'archive_comment_revision_candidate': z.comment.decode('utf-8', errors='replace') or None}

def discover_folder(path: Path, repository: str) -> Path:
    def matches(root: Path) -> bool:
        return all((root / s).is_file() and not (root / s).is_symlink() for s in SENTINELS[repository])
    if matches(path): return path
    candidates = [p for p in path.iterdir() if p.is_dir() and not p.is_symlink() and matches(p)]
    if len(candidates) != 1:
        raise PreflightError(f'Cannot identify exactly one {repository} folder under {path}')
    return candidates[0]

def scan_folder(path: Path, repository: str) -> dict:
    root = discover_folder(path.resolve(), repository)
    entries = []; excluded = []; total = 0
    for current, dirs, files in os.walk(root, followlinks=False):
        parent = Path(current)
        for name in list(dirs):
            p = parent / name; rel = p.relative_to(root).as_posix()
            if name in ADMIN_NAMES:
                dirs.remove(name); excluded.append(rel + '/'); continue
            if p.is_symlink():
                dirs.remove(name)
                target = os.readlink(p).encode('utf-8')
                entries.append(record(rel, 'symlink', hashlib.sha256(target).hexdigest(), len(target)))
        for name in files:
            p = parent / name; rel = p.relative_to(root).as_posix()
            if name in ADMIN_NAMES:
                excluded.append(rel); continue
            mode = p.lstat().st_mode
            if stat.S_ISLNK(mode):
                data = os.readlink(p).encode('utf-8')
                digest, size, kind = hashlib.sha256(data).hexdigest(), len(data), 'symlink'
            elif stat.S_ISREG(mode):
                # Reject files that exceed bounds before streaming.
                if p.stat().st_size > MAX_FILE: raise PreflightError(f'File too large: {rel}')
                with p.open('rb') as stream: digest, size = sha_stream(stream)
                kind = 'file'
            else:
                raise PreflightError(f'Special non-file entry unsupported: {rel}')
            total += size
            if total > MAX_TOTAL: raise PreflightError('Folder exceeds total inspection limit')
            entries.append(record(rel, kind, digest, size))
        if len(entries) > MAX_FILES: raise PreflightError('Folder exceeds file-count limit')
    return {'input_type': 'folder', 'resolved_root': str(root), 'entries': entries,
            'excluded_admin_entries': excluded, 'archive_comment_revision_candidate': None}

def compare_inventory(actual: list[dict], expected: list[dict]) -> dict:
    a = {x['path']: x for x in actual}; e = {x['path']: x for x in expected}
    if len(a) != len(actual): raise PreflightError('Duplicate actual paths')
    changed = []
    for p in sorted(a.keys() & e.keys()):
        fields = [f for f in ('kind', 'sha256', 'size') if a[p][f] != e[p][f]]
        if fields: changed.append({'path': p, 'fields': fields, 'expected': e[p], 'actual': a[p]})
    missing = sorted(e.keys() - a.keys()); extra = sorted(a.keys() - e.keys())
    # Case collisions are reviewed even when a case-sensitive filesystem permits them.
    folds: dict[str, list[str]] = {}
    for p in a: folds.setdefault(p.casefold(), []).append(p)
    collisions = [v for v in folds.values() if len(v) > 1]
    tree = ''.join(f"{x['path']}\0{x['kind']}\0{x['sha256']}\n" for x in sorted(actual, key=lambda x:x['path']))
    return {'matches_baseline': not (missing or extra or changed or collisions),
            'files_checked': len(actual), 'missing': missing, 'extra': extra, 'changed': changed,
            'case_collisions': collisions, 'tree_content_sha256': hashlib.sha256(tree.encode()).hexdigest()}

def is_inside(path: Path, directory: Path) -> bool:
    try: path.resolve().relative_to(directory.resolve()); return True
    except ValueError: return False

def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archify', type=Path, required=True)
    parser.add_argument('--hyperframes', type=Path, required=True)
    parser.add_argument('--out', type=Path, help='Optional report file OUTSIDE source folders; otherwise print JSON')
    args = parser.parse_args(argv)
    package_root = Path(__file__).resolve().parents[1]
    expected_all = json.loads((package_root/'provenance/SOURCE_INVENTORY.json').read_text())['entries']
    reports = {}; errors = []
    try:
        for repo in ('archify','hyperframes'):
            p = getattr(args,repo).expanduser().resolve()
            if not p.exists(): raise PreflightError(f'Input does not exist: {p}')
            if args.out and (args.out.resolve() == p or (p.is_dir() and is_inside(args.out,p))):
                raise PreflightError('Report output must not overwrite or be written inside source inputs')
            scan = scan_folder(p, repo) if p.is_dir() else scan_zip(p, repo)
            expected = [x for x in expected_all if x['repository']==repo]
            summary = compare_inventory(scan.pop('entries'), expected)
            reports[repo] = {'input': str(p), **scan, **summary}
        status = 'PASS' if all(x['matches_baseline'] for x in reports.values()) else 'DRIFT_REQUIRES_REVIEW'
    except (PreflightError, OSError, ValueError, zipfile.BadZipFile, RuntimeError) as exc:
        errors.append(str(exc)); status = 'ERROR'
    report = {'status':status, 'scope':'Read-only source identity check; not an application build or safety certification',
              'inputs_mutated':False, 'upstream_commit_verification':'not_performed', 'repositories':reports, 'errors':errors}
    text=json.dumps(report, indent=2)+'\n'
    if args.out and not errors:
        args.out.parent.mkdir(parents=True,exist_ok=True);args.out.write_text(text,encoding='utf-8')
        print(f'{status}: {args.out}')
    else: print(text)
    return 0 if status=='PASS' else 2

if __name__ == '__main__':
    raise SystemExit(main())
