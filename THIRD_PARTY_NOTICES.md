# Third-party notices

This repository is built from two upstream sources. Both licenses are retained
in full under `licenses/`, and the original copyright headers in imported files
were **not** stripped during rebranding.

## Archify — MIT

```
Copyright (c) 2026 tt-a1i (Archify)
Copyright (c) 2025 Cocoon AI
```

Full text: [`licenses/archify-LICENSE`](licenses/archify-LICENSE).
Upstream third-party notices:
[`licenses/archify-THIRD_PARTY_NOTICES.md`](licenses/archify-THIRD_PARTY_NOTICES.md).

Imported into `packages/diagram-engine/` and `packages/diagram-viewer/`, which
retain their own `LICENSE` and `THIRD_PARTY_NOTICES.md`.

## HyperFrames — Apache License 2.0

Full text: [`licenses/hyperframes-LICENSE`](licenses/hyperframes-LICENSE).

Imported as the workspace foundation: `packages/core`, `producer`, `studio`,
`studio-server`, `sdk`, `player`, `engine`, `cli`, `parsers`, `lint`,
`shader-transitions`, `aws-lambda`, `gcp-cloud-run`, `sdk-playground`.

Apache-2.0 section 4(b) requires modified files to carry prominent notices of
change. Divergences from upstream bytes are tracked in
[`provenance/modification-ledger.json`](provenance/modification-ledger.json),
generated from the import ledger rather than maintained by hand.

## License of this combined work

MIT and Apache-2.0 are compatible. The combined work is distributed under
**Apache-2.0**, the stricter of the two, with the MIT attribution above
retained. This is a local single-user build and is not currently distributed;
see [`docs/designs/scope-local-single-user.md`](docs/designs/scope-local-single-user.md).

## Assets are a separate question

A permissive source-code license does **not** grant rights to fonts, logos,
stock media or hosted catalog payloads that live in the same repository. Those
carry their own terms and have their own decision record:
[`docs/legal/asset-policy.md`](docs/legal/asset-policy.md).
