#!/usr/bin/env python3
"""Validate this planning package, NOT the future application. Python 3.10+."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys
from urllib.parse import unquote

class ValidationError(Exception): pass

def validate(root: Path) -> dict:
    checks=[]
    def require(ok, message):
        if not ok: raise ValidationError(message)
    data=json.loads((root/'backlog/tickets.json').read_text())
    tickets=data['tickets']; by_id={x['id']:x for x in tickets}
    require(len(tickets)==134 and len(by_id)==134,'Expected 134 unique tickets')
    require(set(by_id)=={f'AFM-{i:03}' for i in range(1,135)},'Ticket ID range mismatch')
    checks.append('134 unique contiguous ticket IDs')
    groups=json.loads((root/'provenance/SOURCE_GROUPS.json').read_text())
    inventory=json.loads((root/'provenance/SOURCE_INVENTORY.json').read_text())['entries']
    source={(x['repository'],x['path']):x for x in inventory}
    require(len(source)==len(inventory),'Duplicate source inventory entries')
    target_keys=[x['initial_target'] for x in inventory]
    require(len(target_keys)==len(set(target_keys)),'Planned initial target-path collision')
    for group in groups.values():
        for path in group['paths']:
            require((group['repository'],path) in source,f'Missing source anchor {path}')
    anchors=sum(len(x['paths']) for x in groups.values())
    checks.append(f'{anchors} source anchors resolve in {len(inventory)}-entry inventory')
    for t in tickets:
        require(t['status']=='planned',f"Application ticket incorrectly marked complete: {t['id']}")
        for dep in t['dependencies']:
            require(dep in by_id and dep!=t['id'],f"Invalid dependency {t['id']} -> {dep}")
        require(len(t['implementation'])>=3 and len(t['acceptance'])>=3 and len(t['tests'])>=2,f"Incomplete ticket {t['id']}")
        require(t['source_groups'] and all(g in groups for g in t['source_groups']),f"Invalid source group {t['id']}")
        body=root/t['issue_body_path'];require(body.is_file(),f'Missing issue body: {body}')
        text=body.read_text()
        for item in t['acceptance']+t['tests']:
            require(item in text,f"Issue body differs from JSON: {t['id']}")
        for p in t['target_paths']:require(p in text,f"Missing proposed target in {t['id']}")
    checks.append('All issue bodies, requirements, tests, targets and planned statuses validated')
    remaining=set(by_id);done=set();layers=[]
    while remaining:
        ready=sorted(i for i in remaining if set(by_id[i]['dependencies'])<=done)
        require(ready,'Dependency cycle detected')
        layers.append(ready);done.update(ready);remaining.difference_update(ready)
    require(layers==json.loads((root/'backlog/dependency-layers.json').read_text())['layers'],'Dependency layers out of date')
    require(set(by_id['AFM-134']['dependencies'])==set(by_id)-{'AFM-134'},'Final gate must cover every preceding ticket')
    checks.append(f'Acyclic dependency graph with {len(layers)} layers and full final-gate coverage')
    caps=json.loads((root/'docs/CAPABILITY_MATRIX.json').read_text())['capabilities']
    for cap in caps:require(cap['tickets'] and all(t in by_id for t in cap['tickets']),f"Bad capability map: {cap['id']}")
    cross=json.loads((root/'backlog/supersession.json').read_text())
    require(len(cross)==24 and all(i in by_id for ids in cross.values() for i in ids),'Invalid earlier-backlog crosswalk')
    checks.append(f'{len(caps)} capabilities and all 24 prior-ticket crosswalk entries resolve')
    issue_lines=(root/'backlog/issue-payloads.jsonl').read_text().splitlines()
    require(len(issue_lines)==134,'Issue payload count mismatch')
    for line in issue_lines:
        issue=json.loads(line);require({'title','body','labels'}<=issue.keys(),'Bad issue payload')
    checks.append('134 issue-import records parse correctly')
    missing_links=[]
    for p in root.rglob('*.md'):
        text=p.read_text()
        for target in re.findall(r'\[[^\]]*\]\(([^)]+)\)',text):
            target=target.split('#',1)[0]
            if not target or '://' in target or target.startswith(('mailto:','data:')):continue
            # Imported license notices can cite files belonging to the upstream distribution,
            # not to this planning-only package. Their source context is retained explicitly.
            if 'licenses' in p.relative_to(root).parts:continue
            q=p.parent/unquote(target)
            if not q.exists():missing_links.append(str(p.relative_to(root))+': '+target)
    require(not missing_links,f'Broken local documentation links: {missing_links}')
    checks.append('Local planning-document links resolve')
    forbidden={'.woff','.woff2','.ttf','.otf','.eot'}
    require(not [p for p in root.rglob('*') if p.is_file() and p.suffix.lower() in forbidden],'Font binary found in planning package')
    require(not any(p.name=='node_modules' for p in root.rglob('*')),'node_modules must not be bundled')
    checks.append('No font binaries or dependency directories bundled')
    return {'status':'PASS','scope':'Planning package structural validation ONLY; no application tickets implemented or product tests run',
            'ticket_count':len(tickets),'epic_count':len(json.loads((root/'backlog/epics.json').read_text())),
            'capability_count':len(caps),'source_anchor_count':anchors,'source_inventory_count':len(inventory),
            'dependency_layer_count':len(layers),'checks':checks,'application_implementation':'not_performed'}

def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1])
    parser.add_argument('--out',type=Path)
    args=parser.parse_args(argv)
    try:
        result=validate(args.root.resolve());code=0
    except (ValidationError,OSError,ValueError,KeyError) as exc:
        result={'status':'FAIL','scope':'Planning package only','error':str(exc)};code=1
    text=json.dumps(result,indent=2)+'\n'
    if args.out:
        args.out.parent.mkdir(parents=True,exist_ok=True);args.out.write_text(text)
    print(text)
    return code
if __name__=='__main__':raise SystemExit(main())
