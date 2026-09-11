# Raw-source import and final refactor are separate steps

`SOURCE_INVENTORY.json` accounts for every non-directory archive entry. Its `initial_target` is a **proposed initial source import path**, not a final refactor location and not a claim that files were moved. Engine extraction tickets may move code again into `src/` while maintaining old-to-new provenance. Before deleting any old path, rewrite imports, package assets, tests and docs and pass the affected baseline.

The input `archify-main/` and `hyperframes-main/` directories are read-only staging sources. The final product must not require them at runtime. Hidden configuration, GitHub actions, hooks, docs, test fixtures and release tools count as source to review; copying only renderer files is insufficient.

HyperFrames packages remain at `packages/<name>/` initially. Archify's package code goes to owned diagram packages; its root scripts/examples/docs get explicit relocation and path repairs. The viewer template/assets are separated from engine semantics during extraction, not used as a second app. Existing built exports and nested `archify.zip` are historical/generated material, not an additional source of truth. Inherited publishing and agent hooks are quarantined until reviewed.

Media/font entries are inventoried by name and hash only in this ticket pack. Their availability in an upstream repo is not a clearance determination. Implementation must apply the explicit rights/distribution policy; this pack includes no font binaries or embedded font payloads.

No discarded file is allowed without a ledger reason, responsible ticket, replacement behavior where relevant and tests. Generated/historical material may be excluded from runtime packaging only after its source and regeneration route are accounted for. Symlinks are never blindly followed.
