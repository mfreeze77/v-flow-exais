#!/usr/bin/env python3
"""Verify this package's recorded file hashes; no application tests are executed."""
from pathlib import Path
import argparse, hashlib, json

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1])
    ap.add_argument('--strict-extra',action='store_true')
    args=ap.parse_args();root=args.root.resolve()
    data=json.loads((root/'PACKAGE_MANIFEST.json').read_text())
    errors=[];expected=set()
    for entry in data['files']:
        rel=entry['path'];expected.add(rel);p=root/rel
        if not p.resolve().is_relative_to(root):errors.append(f'Escaping manifest path: {rel}');continue
        if not p.is_file():errors.append(f'Missing: {rel}');continue
        h=hashlib.sha256(p.read_bytes()).hexdigest()
        if h!=entry['sha256'] or p.stat().st_size!=entry['bytes']:errors.append(f'Mismatch: {rel}')
    if args.strict_extra:
        allowed=expected|{'PACKAGE_MANIFEST.json','SHA256SUMS'}
        extra={p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file()}-allowed
        errors.extend('Unexpected: '+p for p in sorted(extra))
    print(json.dumps({'status':'FAIL' if errors else 'PASS','verified_files':len(expected),'errors':errors},indent=2))
    return 1 if errors else 0
if __name__=='__main__':raise SystemExit(main())
