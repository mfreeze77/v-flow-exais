# Sources and verification boundaries

Primary implementation authority: the user-provided `archify-main.zip` and `hyperframes-main.zip`, their full raw-byte manifests, selected source anchors and nearest tests. Metadata records Archify package 2.17.0-dev.1 and most HyperFrames packages 0.8.34; SDK playground declares 0.6.106 in this snapshot. These are observed package declarations, not claims about latest npm releases.

Official documentation consulted September 10, 2026 as interface/design context:

- HyperFrames Studio: https://hyperframes.heygen.com/packages/studio
- Studio API: https://hyperframes.heygen.com/packages/studio-server
- SDK: https://hyperframes.heygen.com/packages/sdk
- Producer: https://hyperframes.heygen.com/packages/producer
- Deterministic rendering: https://hyperframes.heygen.com/concepts/determinism
- GSAP composition animation: https://hyperframes.heygen.com/guides/gsap-animation
- Bun workspaces: https://bun.sh/docs/pm/workspaces

The plan reuses the existing Studio/server, SDK and producer; shared project transactions and semantic scene compilation are new work. Current docs may move beyond the pinned uploads. In any conflict, inspect the uploaded source, run its tests, and amend the contract deliberately. Documentation examples do not certify the merged implementation.

This turn validates planning artifacts and planning tools only. It does not install/build/test the combined application, execute HyperFrames video rendering, create GitHub forks, or verify upstream revision candidates against Git hosting. Historical Archify-only test results in prior reviews are not counted as new-product evidence.
