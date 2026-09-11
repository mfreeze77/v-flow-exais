# Start here: two raw folders to one new repo

## 1. Arrange your workspace

```text
workspace/
  archify-main/                           # Your raw downloaded Archify folder
  hyperframes-main/                       # Your raw downloaded HyperFrames folder
  archframe-unified-implementation-v2.0.0/ # This unzipped ticket package
  archframe-studio/                       # NEW output; implementing agent creates it
```

The two original folders are **input source snapshots**, not permanent apps inside the finished product. They do not need `.git`, dependency installs or upstream commit histories. The output must be a new directory; never initialize the output inside an input folder or overwrite either input. A normal GitHub download ZIP is also supported by the included preflight checker.

## 2. Optional: check the plan and sources before coding

Run these existing **planning tools** from this package's directory. They use only Python's standard library. On Windows use `py -3` in place of `python` when appropriate; on macOS/Linux use `python3` where required.

```sh
python tools/validate_pack.py
python tools/preflight_sources.py --archify ../archify-main --hyperframes ../hyperframes-main --out ../archframe-source-preflight.json
```

For ZIP inputs:

```sh
python tools/preflight_sources.py --archify ../archify-main.zip --hyperframes ../hyperframes-main.zip --out ../archframe-source-preflight.json
```

Exit code `0` means the inspected inputs match this package's baseline under the documented raw-byte/type comparison. Exit code `2` means drift, missing input or unsafe input requires review. A fresh download can differ from these snapshots. That is a source-change report, **not** permission to substitute newer code silently. The implementing agent must re-inspect affected interfaces, update provenance and ticket source mappings, then rerun the dependency/capability checks. No preflight command copies, modifies, installs, commits, publishes or merges application code.

## 3. Give the agent the complete kickoff prompt

Open [prompts/IMPLEMENTATION_KICKOFF.md](prompts/IMPLEMENTATION_KICKOFF.md). It is designed to be supplied with the workspace root to a coding agent or `/goal` workflow. Do not supply only a summary of the tickets: the prompt instructs the agent to read the actual contracts, individual issues, dependency graph and source inventory.

Begin with **AFM-001**. Gate **AFM-129 / G0** proves the source baseline. Gate **AFM-130 / G1** proves the first real architecture scene. The final acceptance gate is **AFM-134 / G5**. A first successful video is an intermediate milestone, not completion of the whole repo.

## 4. Keep planning-tool status separate from application status

`planning-validation.json` describes checks on this ticket package only. It does not say any app ticket is implemented. The coding agent must create per-ticket receipts and actual test/render evidence in the new repo. Required future root commands, contracts and target source files are specified by tickets; they are not provided as an application skeleton in this package.

## 5. Remote actions are separate

No GitHub organization, repository name, visibility or publishing destination is assumed. A new local Git repo and source archive satisfy the repository handoff until remote publication is separately authorized. Never push to an upstream remote, publish `@hyperframes/*`, or deploy using inherited workflow defaults.
