# Included planning tools

These tools are implemented in this package. They validate the **ticket package and source identity**, not the future application. They use Python 3.10+ standard library only. No package install, app merge, source mutation, Git action or network call occurs.

## Validate ticket package

```sh
python tools/validate_pack.py
```

Checks 134 ticket IDs/bodies, dependency references and cycles, final-gate coverage, source anchor existence within the inventory, initial import target collisions, capability/crosswalk mappings, issue-export JSON, local documentation links and absence of bundled font binaries/dependency trees. This does not execute any TypeScript/app acceptance test or prove source functions work.

## Compare raw folders or ZIPs to the inspected inputs

```sh
python tools/preflight_sources.py --archify ../archify-main --hyperframes ../hyperframes-main --out ../source-check.json
python tools/preflight_sources.py --archify ../archify-main.zip --hyperframes ../hyperframes-main.zip --out ../source-check.json
```

A single wrapper directory and renamed source folder are supported through sentinel discovery. ZIPs are read directly, not extracted. Symlink target strings are hashed, never followed for content. Administrative `.git`, `node_modules`, `.DS_Store`, and `__MACOSX` entries are excluded and reported; tracked source/build files are not silently ignored. Source matching compares raw bytes, size and entry type. It does not treat line-ending changes or a ZIP symlink materialized as a regular file as exact equivalence. Executable modes are recorded in the baseline inventory but are not part of this cross-platform content comparison; mode repair is a separate implementation ticket.

Exit `0`: the inputs match the recorded baseline and have no case-collision finding. Exit `2`: drift or input/error condition needs review. Read the JSON report. Do not use a force flag or update hashes merely to suppress a mismatch. Newly downloaded upstream versions require source/interface review and rebaselining. Root/destination safety and import application are future AFM-001–AFM-006 implementation work; this checker never copies a repository.

Limits: 100,000 files, 2 GiB inspected content and 512 MiB per file; encrypted ZIPs, unsafe entry names and ambiguous source roots are rejected. The checker is a bounded inspection helper, not a hardened concurrent-filesystem sandbox. Do not run against adversarial source trees being modified concurrently. Report output must be outside the input sources. Generated reports may include local source paths; redact them before public sharing.

## Test these tools

```sh
python -m unittest discover -s tools -p 'test_*.py' -v
```

Tool tests cover folder/ZIP discovery, content drift, symlink typing, unsafe paths, duplicate archives, output guard and dependency validation. Actual uploaded-source checks are recorded separately under provenance/. None of these tests counts as an implemented application ticket.

## Issue tracker export

`backlog/issue-payloads.jsonl` is a static export of title/body/labels; `backlog/tickets.json` retains dependencies and structured requirements. No external issues are created. Read `backlog/ISSUE_IMPORT.md` before transforming records for an API.

## Verify delivered package integrity

```sh
python tools/verify_manifest.py --strict-extra
```

This compares payload hashes and checks for unexpected files. New local report files may legitimately fail strict-extra; omit that flag for a modified working planning copy. The outer ZIP checksum is provided separately.
