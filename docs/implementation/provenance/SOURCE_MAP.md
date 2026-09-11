# Verified source map

All paths below exist in the provided raw archives. They are inspection/reuse anchors, not proof of runtime correctness. Full per-file hashes and proposed import dispositions are in `SOURCE_INVENTORY.json`. Destination paths in tickets are proposed and must be implemented.

## A-PKG — Package, CLI, release identity

- `archify-main/archify/package.json` — SHA-256 `7fe2a96f0d6730b2d35811d7d4f5e7e969c166a47a0c87543cdf667a221815be`; initial import target `packages/diagram-engine/package.json`.
- `archify-main/archify/package-lock.json` — SHA-256 `f875c29b190f6f5dc14bea7e56879ad2282c0a5212253b24937f77b4f6198054`; initial import target `packages/diagram-engine/package-lock.json`.
- `archify-main/archify/bin/archify.mjs` — SHA-256 `cb00a6a60cff395f1728722ce6c41b7721b484c5349ae82111ee16719a672721`; initial import target `packages/diagram-engine/bin/archify.mjs`.
- `archify-main/archify/skill-release.json` — SHA-256 `269772492c38663b5d19730a54e5d7ad973ef04e47eb4f75b6dfa2e249614097`; initial import target `packages/diagram-engine/skill-release.json`.

## A-LICENSE — Attribution and third-party asset constraints

- `archify-main/LICENSE` — SHA-256 `b799ab081703e7821ae5096d2c1abdf14bbdc75e8ea1c4045998c36ed6db9706`; initial import target `licenses/archify-LICENSE`.
- `archify-main/THIRD_PARTY_NOTICES.md` — SHA-256 `0b7fb59365dc21c93b0f62526d74ee913aeec9ae532c112bc76afa7edcd56e14`; initial import target `licenses/archify-THIRD_PARTY_NOTICES.md`.
- `archify-main/archify/THIRD_PARTY_NOTICES.md` — SHA-256 `0b7fb59365dc21c93b0f62526d74ee913aeec9ae532c112bc76afa7edcd56e14`; initial import target `packages/diagram-engine/THIRD_PARTY_NOTICES.md`.

## A-ROOT — Root build and test scripts with relative-path assumptions

- `archify-main/scripts/run-tests.mjs` — SHA-256 `de6be62e88fd32bdb8fb5b5d67527f351de9f62ce75d9608b5a0321ef1c24750`; initial import target `tools/upstream-archify/run-tests.mjs`.
- `archify-main/scripts/check-release-identity.mjs` — SHA-256 `5783d3cc72971a4733159971460348c6a694f09780012f3b58f9dce21eb46d24`; initial import target `tools/upstream-archify/check-release-identity.mjs`.
- `archify-main/scripts/stage-clean-skill.mjs` — SHA-256 `8a2a4ec980ab7667c09d4f2fc3bd3c80139d86227c4598a3f4350e84aac4ac27`; initial import target `tools/upstream-archify/stage-clean-skill.mjs`.
- `archify-main/scripts/write-deterministic-zip.mjs` — SHA-256 `1cbfec5b5dce2f94515d1a4805d78121b8fa0d3ca5dfa1603759c40dec637618`; initial import target `tools/upstream-archify/write-deterministic-zip.mjs`.
- `archify-main/scripts/package-smoke.mjs` — SHA-256 `1dd307460fade6479109c3521f9e6c9c1e2789a466ad9481aff5775599f6dde9`; initial import target `tools/upstream-archify/package-smoke.mjs`.

## A-SHARED — Current IO boundary and semantic hooks

- `archify-main/archify/renderers/shared/cli.mjs` — SHA-256 `2a6b8fa11234451627a70bca71985d80362a4c52401a90a21840d6e2ae3012d9`; initial import target `packages/diagram-engine/renderers/shared/cli.mjs`.
- `archify-main/archify/renderers/shared/output-path.mjs` — SHA-256 `44a5f63239703a0a56623711bb9565272488c540650cb8c3f0a3aac57928d1cf`; initial import target `packages/diagram-engine/renderers/shared/output-path.mjs`.
- `archify-main/archify/renderers/shared/diagnostics.mjs` — SHA-256 `855fea15daf2beb5be7fad0d54b72a63a4af8595f227facf845ba1852b3b365a`; initial import target `packages/diagram-engine/renderers/shared/diagnostics.mjs`.

## A-SCHEMA — Typed diagram schemas and generated validators

- `archify-main/archify/schemas/common.schema.json` — SHA-256 `2630c958314eeebb92e0f6f6330475f1a2bc48f8c1b53201ba3b58889b319c80`; initial import target `packages/diagram-engine/schemas/common.schema.json`.
- `archify-main/archify/renderers/shared/validator.mjs` — SHA-256 `7460d7fcbcdf710649256c5e96142ae26d807a655d3296ee8caf7f5e158622cc`; initial import target `packages/diagram-engine/renderers/shared/validator.mjs`.
- `archify-main/archify/renderers/shared/generated-validators.mjs` — SHA-256 `a1843e5612916e7ff71511d8577cdbea9a1355eee0ed1379de0ffd668992387f`; initial import target `packages/diagram-engine/renderers/shared/generated-validators.mjs`.
- `archify-main/archify/scripts/generate-validators.mjs` — SHA-256 `a5f5f67d3cd4675b16fa620043a5463f3c15aad89afb1b0c7cf42cf35e883f9a`; initial import target `packages/diagram-engine/scripts/generate-validators.mjs`.

## A-ARCH — Architecture layout, source schema and example

- `archify-main/archify/renderers/architecture/render-architecture.mjs` — SHA-256 `f57077cb9fa64a8412ab0af705cb31e2e7a920114b31852882c04a76840365dc`; initial import target `packages/diagram-engine/renderers/architecture/render-architecture.mjs`.
- `archify-main/archify/renderers/architecture/grid.mjs` — SHA-256 `f6de99c32436feed3378b0ddef516bb4732ff27a89c543b50635d4d14a15a55a`; initial import target `packages/diagram-engine/renderers/architecture/grid.mjs`.
- `archify-main/archify/schemas/architecture.schema.json` — SHA-256 `94568c7ca72c07ac0ee02ee76bd39392874b3a13bb796a127962be68d0f5bc90`; initial import target `packages/diagram-engine/schemas/architecture.schema.json`.
- `archify-main/archify/examples/production-deployment.architecture.json` — SHA-256 `ec484aa8576664fdb207b543fa49486b23273faccb7a5071e1a0becfb48c22eb`; initial import target `packages/diagram-engine/examples/production-deployment.architecture.json`.

## A-WORK — Workflow compile, migrate, and branch semantics

- `archify-main/archify/renderers/workflow/render-workflow.mjs` — SHA-256 `83be05d1efd1816c527fccdf3ebbd4a0f1454c6cb0c9f7554c6702eb40d9c540`; initial import target `packages/diagram-engine/renderers/workflow/render-workflow.mjs`.
- `archify-main/archify/renderers/workflow/workflow-compiler.mjs` — SHA-256 `06dc97f67041037d71fd8731934d4833ece95ac1a4278e3ef875b0e51e516104`; initial import target `packages/diagram-engine/renderers/workflow/workflow-compiler.mjs`.
- `archify-main/archify/migrations/workflow-v2.mjs` — SHA-256 `77aadc38460e5e778344901f492cc00f16f74e8fe1def14b01e6d6d346b9f4c7`; initial import target `packages/diagram-engine/migrations/workflow-v2.mjs`.
- `archify-main/archify/schemas/workflow.schema.json` — SHA-256 `2128e82afd2b971fcb7d80ada86fa836bb4a5035b504053b87d3aeefec380e3c`; initial import target `packages/diagram-engine/schemas/workflow.schema.json`.
- `archify-main/archify/examples/agent-tool-call.workflow.json` — SHA-256 `4d3f6c23de2ca7d306e05d0041a9506833bb5a164a2bddc2d1984cf4da3ee90c`; initial import target `packages/diagram-engine/examples/agent-tool-call.workflow.json`.

## A-SEQ — Ordered messages and participants

- `archify-main/archify/renderers/sequence/render-sequence.mjs` — SHA-256 `230c0fb79775badb4beb6fd74f45ed1ffbb70e932c3641a24bedcc61f912bddf`; initial import target `packages/diagram-engine/renderers/sequence/render-sequence.mjs`.
- `archify-main/archify/schemas/sequence.schema.json` — SHA-256 `c9fec3fad087f14d55c0bb2d34446246e3405f0238c292c1cb6bef28d1120fcb`; initial import target `packages/diagram-engine/schemas/sequence.schema.json`.
- `archify-main/archify/examples/cache-miss-request.sequence.json` — SHA-256 `9a799a3661c16cd6ab4f6373ff6a04da95a9ab70d93b0a349b668466f4912fd7`; initial import target `packages/diagram-engine/examples/cache-miss-request.sequence.json`.
- `archify-main/archify/test/sequence-column-fit.test.mjs` — SHA-256 `e3de2b0837390d31481c2d0533aed467de0263439b494843eff992060e5b0dd6`; initial import target `packages/diagram-engine/test/sequence-column-fit.test.mjs`.

## A-DATA — Dataflow renderer, schema and examples

- `archify-main/archify/renderers/dataflow/render-dataflow.mjs` — SHA-256 `5a5da505e5c68041990de92847f53a38215efb9212bc36fc911774e8829335c9`; initial import target `packages/diagram-engine/renderers/dataflow/render-dataflow.mjs`.
- `archify-main/archify/schemas/dataflow.schema.json` — SHA-256 `09d238a6a18f2e074ec69c8f905f58a44d3a0b68fc6a925b8346c484a912af90`; initial import target `packages/diagram-engine/schemas/dataflow.schema.json`.
- `archify-main/archify/examples/product-analytics.dataflow.json` — SHA-256 `91411404fb4828a3b7ea358f3a7b9877781c9e9dc9c04b42b6eb4a757281b59f`; initial import target `packages/diagram-engine/examples/product-analytics.dataflow.json`.
- `archify-main/archify/examples/event-stream.dataflow.json` — SHA-256 `a92d6597ddbe164f395da32a7d4b33cfae08edd7d9600a6fb45a2058e5bbb43e`; initial import target `packages/diagram-engine/examples/event-stream.dataflow.json`.

## A-LIFE — Lifecycle states and transitions

- `archify-main/archify/renderers/lifecycle/render-lifecycle.mjs` — SHA-256 `23720729a14495b4085839653ec0622f2465be3b1e8c9eb556b602ab3f4a8cda`; initial import target `packages/diagram-engine/renderers/lifecycle/render-lifecycle.mjs`.
- `archify-main/archify/schemas/lifecycle.schema.json` — SHA-256 `05b46c0db95ee7ed44305b61496a96bb4f69342b20f9903d6534d952ebc65083`; initial import target `packages/diagram-engine/schemas/lifecycle.schema.json`.
- `archify-main/archify/examples/agent-run.lifecycle.json` — SHA-256 `7c0ad72ee7affbd6c6e4758b7520d61ddd4508c917acf36beabcad3ee7ca3ba7`; initial import target `packages/diagram-engine/examples/agent-run.lifecycle.json`.
- `archify-main/archify/examples/deployment-release.lifecycle.json` — SHA-256 `735c2c5819266e6ea2a71775b6eefce98b53030ce90cb721dc8e1d022ce5be71`; initial import target `packages/diagram-engine/examples/deployment-release.lifecycle.json`.

## A-GEOM — Geometry, text fit, layout diagnostics

- `archify-main/archify/renderers/shared/geometry.mjs` — SHA-256 `161785af32241fc96df051c9be4f2bb9c3b897418d708f4a051b63f1c44952cf`; initial import target `packages/diagram-engine/renderers/shared/geometry.mjs`.
- `archify-main/archify/renderers/shared/text-fit.mjs` — SHA-256 `35b6ef2c64d88c1ea4e5aab2af7c4e8a2c2e1be62db71263787d39a9797e7dea`; initial import target `packages/diagram-engine/renderers/shared/text-fit.mjs`.
- `archify-main/archify/renderers/shared/desktop-readability.mjs` — SHA-256 `b36203a11df348706e541f309266a0f9b914dac6a7eb8ba804e3abe8f8d6c710`; initial import target `packages/diagram-engine/renderers/shared/desktop-readability.mjs`.
- `archify-main/archify/renderers/shared/layout-report.mjs` — SHA-256 `44c2f74a20e483dd37dae6791ede39284ce3bac1a2a13872d2912999e8504df5`; initial import target `packages/diagram-engine/renderers/shared/layout-report.mjs`.
- `archify-main/archify/test/geometry.test.mjs` — SHA-256 `8a341c048bf86dda21e19337729f7709ea3645b6f311a3eb3b795ef10fef7131`; initial import target `packages/diagram-engine/test/geometry.test.mjs`.

## A-EVID — Source references and engineering metadata

- `archify-main/archify/renderers/shared/repository-evidence.mjs` — SHA-256 `ce3c358093aee12790d5567de6c887ce7b9ce7961bfc742d2cf9f36eab2d4dd5`; initial import target `packages/diagram-engine/renderers/shared/repository-evidence.mjs`.
- `archify-main/archify/renderers/shared/repository-location.mjs` — SHA-256 `e82fa68ab46e71566eb7aefdb48f6df67b34fd27ce36489e7787410dbfba05ce`; initial import target `packages/diagram-engine/renderers/shared/repository-location.mjs`.
- `archify-main/archify/renderers/shared/engineering-profiles.mjs` — SHA-256 `7e99f9d5423f66cc9ab6224da56dc2d5aa6c6faec29178034794e9db6b5b2889`; initial import target `packages/diagram-engine/renderers/shared/engineering-profiles.mjs`.
- `archify-main/archify/test/repository-evidence.test.mjs` — SHA-256 `a078539c8b61f26f3694c44dced2e83eb58d3f5ad16556d23d6bcf3ea594fd0b`; initial import target `packages/diagram-engine/test/repository-evidence.test.mjs`.

## A-VIEW — Standalone artifact and guided presentation

- `archify-main/archify/assets/template.html` — SHA-256 `b3583470b9ec789418207963405252141c710b1b8a5c08a6cfd03156712f3f7d`; initial import target `packages/diagram-viewer/assets/template.html`.
- `archify-main/archify/test/guided-views.test.mjs` — SHA-256 `fbed156af01082f3bbde7b0c0b6675664613c47644e14a33fad3fbd1b8dc062e`; initial import target `packages/diagram-engine/test/guided-views.test.mjs`.
- `archify-main/archify/test/story-follow-camera.test.mjs` — SHA-256 `edc511d606a6eb18e41d8110a6fb9c9c0958c5638dce109ffb7968151cc709d7`; initial import target `packages/diagram-engine/test/story-follow-camera.test.mjs`.
- `archify-main/archify/test/semantic-camera.test.mjs` — SHA-256 `2f547c8eee6519371ebe72343428ee1bf0f94f7a072b8c1eae02a7c73fde327e`; initial import target `packages/diagram-engine/test/semantic-camera.test.mjs`.

## A-REACH — Authored graph inspection and sharing

- `archify-main/archify/test/authored-reachability.test.mjs` — SHA-256 `b243c1568c8470a28cfbebc6b9db4dfe0302e7f37f5c451ccffec53de23fd01b`; initial import target `packages/diagram-engine/test/authored-reachability.test.mjs`.
- `archify-main/archify/test/route-probe.test.mjs` — SHA-256 `3bc76e9426254f5589466e1fa3d10c826b4e5e883f6b7f67bc371061c3405f25`; initial import target `packages/diagram-engine/test/route-probe.test.mjs`.
- `archify-main/archify/test/relationship-direct-explorer.test.mjs` — SHA-256 `1411a6540f608a99f328c0bdbdc542795fb6f296e80be3af1bf0740d55dae7b2`; initial import target `packages/diagram-engine/test/relationship-direct-explorer.test.mjs`.
- `archify-main/archify/test/relationship-permalink.test.mjs` — SHA-256 `c2425e42a1b78b8a9714b675a2330352c78cc59880ab5d3ac7628c794490e3c6`; initial import target `packages/diagram-engine/test/relationship-permalink.test.mjs`.
- `archify-main/archify/test/reach-share-card.test.mjs` — SHA-256 `b94cc337cacc3e412ff08d00e88078d975e1fa2c32ad7d72a37fcffe151a8832`; initial import target `packages/diagram-engine/test/reach-share-card.test.mjs`.

## A-DELTA — Before/after receipts and geometry

- `archify-main/archify/delta/architecture-delta.mjs` — SHA-256 `ccff0af2cf5dbaaca90fe761fc28fd885fd4e4b2811d6314c74a6e0960f79046`; initial import target `packages/diagram-engine/delta/architecture-delta.mjs`.
- `archify-main/archify/test/architecture-delta.test.mjs` — SHA-256 `635816a7b89f7b6e0de92c79bb0226313249962f2bdf4bc42165f925ce2e78fc`; initial import target `packages/diagram-engine/test/architecture-delta.test.mjs`.
- `archify-main/archify/examples/checkout-platform.base.architecture.json` — SHA-256 `c112195e7285e3e4aedaeab3e1f85f5891d30fccc2c260aebe4e1da12c80cf84`; initial import target `packages/diagram-engine/examples/checkout-platform.base.architecture.json`.
- `archify-main/archify/examples/checkout-platform.head.architecture.json` — SHA-256 `e3aaf47f77afeadafc81c6ce853dc1df68cc1e6932dec972cf478f4008fdda99`; initial import target `packages/diagram-engine/examples/checkout-platform.head.architecture.json`.

## A-THEME — Brand registry, locale and presets

- `archify-main/archify/renderers/shared/brand-marks.mjs` — SHA-256 `4557b7f3eec25a3dba66a0f5da1c5dca6ec607e2a68e9be51cd697cefe9e6425`; initial import target `packages/diagram-engine/renderers/shared/brand-marks.mjs`.
- `archify-main/archify/renderers/shared/generated-brand-marks.mjs` — SHA-256 `0f157d229c12df6f53763a3b88684baa5803a52484c49c4d34ec40b8743beea2`; initial import target `packages/diagram-engine/renderers/shared/generated-brand-marks.mjs`.
- `archify-main/archify/renderers/shared/i18n.mjs` — SHA-256 `0d9e839c3e5346160b0028d07fcf78c86671189e0714ea069dc99913e859fcdb`; initial import target `packages/diagram-engine/renderers/shared/i18n.mjs`.
- `archify-main/archify/test/preset-tryon.test.mjs` — SHA-256 `92c45df6deac7ccefcb8c1c38ad0f0ba7f42ddd737e5ef0baa9d15aa57ef1719`; initial import target `packages/diagram-engine/test/preset-tryon.test.mjs`.
- `archify-main/archify/test/i18n.test.mjs` — SHA-256 `12a6b17fcde1fddbf496f46e15bfd76db931e4f0c9c832e772a12a0ee0d02b17`; initial import target `packages/diagram-engine/test/i18n.test.mjs`.

## A-EXPORT — Artifact and visual validation / export behavior

- `archify-main/archify/scripts/check-render-output.mjs` — SHA-256 `cd70eeb43b07b6a669e10e35f06e4e2e4ce1f7e7a6afcfcf349d75d00e0721a5`; initial import target `packages/diagram-engine/scripts/check-render-output.mjs`.
- `archify-main/archify/bin/visual-check.mjs` — SHA-256 `8fa8c6f233f3598f4f22e58c48a4de6f45b3b072ad8e7aee4731c49b4bfbdc52`; initial import target `packages/diagram-engine/bin/visual-check.mjs`.
- `archify-main/archify/test/share-card-export.test.mjs` — SHA-256 `635ebf918753136fd8dad6f40e01676fd993b64a5869d7a40620253959c8ec2e`; initial import target `packages/diagram-engine/test/share-card-export.test.mjs`.
- `archify-main/archify/test/webm-artifact.smoke.mjs` — SHA-256 `99444dd6a61ec307c8bb3d18378233bf67cd9ee4e025e2f46007c69c0115a502`; initial import target `packages/diagram-engine/test/webm-artifact.smoke.mjs`.
- `archify-main/archify/test/golden.mjs` — SHA-256 `ad0a1e34a43d4ab07a97fbca5c2d2358162a240fabda3a69d419bce6631ea6b7`; initial import target `packages/diagram-engine/test/golden.mjs`.

## A-SKILL — Agent guidance and recipes

- `archify-main/archify/SKILL.md` — SHA-256 `10094272d6d1b4ad0f2c2e0880cb646fe4991454a2dc3d854aecb27e7407ee1f`; initial import target `packages/diagram-engine/SKILL.md`.
- `archify-main/archify/recipes/scenarios.mjs` — SHA-256 `e77d31d5b65b921799f4f560287fbac24feb3cd683bee8cabe49ed1ddde1a8ac`; initial import target `packages/diagram-engine/recipes/scenarios.mjs`.
- `archify-main/archify/scripts/check-update.mjs` — SHA-256 `7c7f47b35a55754fd85468c5e1cfc467bb2e1b9dd5c683dd60172844882b1970`; initial import target `packages/diagram-engine/scripts/check-update.mjs`.
- `archify-main/archify/scripts/update-contract.mjs` — SHA-256 `7c5d34c5fa2e08fcd0b42e33a0f3b4685fcecf3ac88f1ed820528df8fdc46cbc`; initial import target `packages/diagram-engine/scripts/update-contract.mjs`.

## H-PKG — Workspace, runtime and build baseline

- `hyperframes-main/package.json` — SHA-256 `656e53de03966a18b6b6626cbd2b0b6f918f1ac260d794cee3ed41e8dfff1ff2`; initial import target `package.json`.
- `hyperframes-main/bun.lock` — SHA-256 `1214990c9b1a33c5d4c88fb4c7f9ce6d62f72c9f956b02b68ee8f130945fdf12`; initial import target `bun.lock`.
- `hyperframes-main/packages/cli/package.json` — SHA-256 `db87cff6622b92f64fb32d0e9e4e43d00ac6b886ae53ebede63dbc3330f488da`; initial import target `packages/cli/package.json`.
- `hyperframes-main/packages/producer/package.json` — SHA-256 `0cb0c56d3bf19008d3aa32c1dd86c77759a324ff3abfebb8f2c7278a6375cd9f`; initial import target `packages/producer/package.json`.
- `hyperframes-main/packages/sdk-playground/package.json` — SHA-256 `95e8f661b25c744909e4beade9b3f6e54df0c4552bef2a17685f8d264031c5e8`; initial import target `packages/sdk-playground/package.json`.

## H-CI — Existing build/release workflows and checks

- `hyperframes-main/.github/workflows/ci.yml` — SHA-256 `c46aa840a6fb607c48337027a39db23d5b1a203cf90169ad7c7ed78031056bc6`; initial import target `docs/upstream/hyperframes/workflows/ci.yml`.
- `hyperframes-main/.github/workflows/publish.yml` — SHA-256 `b5465a86a9cfa9aae0d9013a4452a722344c0cdcfffaee575c6ff52cf6341bbf`; initial import target `docs/upstream/hyperframes/workflows/publish.yml`.
- `hyperframes-main/.github/workflows/windows-render.yml` — SHA-256 `761e102c5e7d595fc0273100e60240e536fa09739e5e3df326aa8f5a12be4f77`; initial import target `docs/upstream/hyperframes/workflows/windows-render.yml`.
- `hyperframes-main/scripts/check-workspace-contracts.mjs` — SHA-256 `00103fa49d62fabcfd9d0c35d58560ea0472bd7d1cdb62cf2b7475a90e43b71e`; initial import target `scripts/check-workspace-contracts.mjs`.
- `hyperframes-main/scripts/check-package-cycles.mjs` — SHA-256 `658cbb8c4eac81febd96577741f58ad6a2186e07c9c0f5747f99176279be9277`; initial import target `scripts/check-package-cycles.mjs`.

## H-LICENSE — License, contribution and security records

- `hyperframes-main/LICENSE` — SHA-256 `4259155fb06f127687ee7b0a8a3682d45132db0f2da26cbc0b7a2d1e796436b8`; initial import target `licenses/hyperframes-LICENSE`.
- `hyperframes-main/CREDITS.md` — SHA-256 `081014cf0c30f1c5c0f63bb74d0f7722d32790d8025043f00825b5cc18ce47c5`; initial import target `docs/upstream/hyperframes/CREDITS.md`.
- `hyperframes-main/SECURITY.md` — SHA-256 `dc0f0eb37c7976a928ede24f608f75b36802907340f882b53e967219b6b5a760`; initial import target `docs/upstream/hyperframes/SECURITY.md`.
- `hyperframes-main/CONTRIBUTING.md` — SHA-256 `dea56da4123d393f3b13963522dd253eb7e8e08d5ed2202eef1371c7960a8ec8`; initial import target `docs/upstream/hyperframes/CONTRIBUTING.md`.

## H-CORE — Composition compiler and standard composition contracts

- `hyperframes-main/packages/core/src/compiler/compositionScoping.ts` — SHA-256 `6e087562747b7af9b6bcade5b7ae870cbfd0542b4fb7a61d0bf6044cc4df8fd2`; initial import target `packages/core/src/compiler/compositionScoping.ts`.
- `hyperframes-main/packages/parsers/src/compositionContract.ts` — SHA-256 `c23d03ac35692bc2e1549f82b7bd0222395243e9e554b6ec8fd5f5c1d85c9b3d`; initial import target `packages/parsers/src/compositionContract.ts`.
- `hyperframes-main/packages/parsers/src/composition.ts` — SHA-256 `9dcfcaa3fe4a81704bd3a0e0175c753fc18fb4f555dbe4b5af994a27fc23b0ef`; initial import target `packages/parsers/src/composition.ts`.
- `hyperframes-main/packages/parsers/src/subCompositionValidity.ts` — SHA-256 `29e3cb55dace2d7b43e36e491c6e694abd7c20fea1e7b2f22b90a3902b5de6e2`; initial import target `packages/parsers/src/subCompositionValidity.ts`.

## H-TIME — Seek adapter and playback time

- `hyperframes-main/packages/core/src/adapters/gsap.ts` — SHA-256 `e0e05df6c1dd109fb46d147776b7727a3536eac66dba3bcc65cb3ab129eaea41`; initial import target `packages/core/src/adapters/gsap.ts`.
- `hyperframes-main/packages/core/src/adapters/types.ts` — SHA-256 `d60f8ca90b6e20458f860cb1e64065b76fc33416b9bbfdf11cbfb8ee69ee9d0c`; initial import target `packages/core/src/adapters/types.ts`.
- `hyperframes-main/packages/player/src/direct-timeline-clock.ts` — SHA-256 `d8903e87ed038811e7d0b775047a82b7a0c0aea1d5f4e43edc9c24135e49ebb3`; initial import target `packages/player/src/direct-timeline-clock.ts`.
- `hyperframes-main/packages/player/src/timeline-adapters.ts` — SHA-256 `cf158f87a4a381c4e8ed94f4b17c76db0f9c5a4771460a5f558d587ac548d17b`; initial import target `packages/player/src/timeline-adapters.ts`.

## H-PARSER — DOM identities, GSAP and roundtrip editing

- `hyperframes-main/packages/parsers/src/hfIds.ts` — SHA-256 `9f34094507026b5e474870c7df26298f804894b2dac96556f4ab6d2b2701892d`; initial import target `packages/parsers/src/hfIds.ts`.
- `hyperframes-main/packages/parsers/src/hfIdAssignment.ts` — SHA-256 `952f3964963752cb31541d238179ea23bf8a1c3ca37e6b703f9226a3c65862fa`; initial import target `packages/parsers/src/hfIdAssignment.ts`.
- `hyperframes-main/packages/parsers/src/gsapParser.ts` — SHA-256 `94a3e36e6081a99e14e6edf5ccfad55c787d1e2e248cd55495d30628019b9b45`; initial import target `packages/parsers/src/gsapParser.ts`.
- `hyperframes-main/packages/parsers/src/gsapSerialize.ts` — SHA-256 `8d03fbc9dfad928360afeed62cc3d587372abfedf17785feeb8dded0003f03ee`; initial import target `packages/parsers/src/gsapSerialize.ts`.
- `hyperframes-main/packages/parsers/src/htmlParser.ts` — SHA-256 `7c6ebf1b9a381087e289b5dbbcfdfcf70337de250d8f6b0555559280e262741d`; initial import target `packages/parsers/src/htmlParser.ts`.

## H-SDK — Headless edits, capability checks and patch history

- `hyperframes-main/packages/sdk/src/session.ts` — SHA-256 `f2b572cc07c389bd00eafe44fab2ac74fee8db0dea52b4e56a047b9e19318780`; initial import target `packages/sdk/src/session.ts`.
- `hyperframes-main/packages/sdk/src/history.ts` — SHA-256 `9d73f92938f87df3b4ef42044e9be2067afc5599a69bb8ae44f321e82b238e52`; initial import target `packages/sdk/src/history.ts`.
- `hyperframes-main/packages/sdk/src/engine/apply-patches.ts` — SHA-256 `38499bcdf9498315d195d126818df1a5135adb1a719f22eb7061b2009de4dc6f`; initial import target `packages/sdk/src/engine/apply-patches.ts`.
- `hyperframes-main/packages/sdk/src/editing/affordances.ts` — SHA-256 `dda7bd5c7c4eb9184517ef5f0ae9dbf5837d168796161067a27ef2d608e0d009`; initial import target `packages/sdk/src/editing/affordances.ts`.
- `hyperframes-main/packages/sdk/src/types.ts` — SHA-256 `bac17a24a97f66ca2ed5a431e250ab3f1d0d66aa618378d8203ab8cffc5bc3d4`; initial import target `packages/sdk/src/types.ts`.

## H-PERSIST — SDK persistence and project file writes

- `hyperframes-main/packages/sdk/src/persist-queue.ts` — SHA-256 `ea00b88d76a51cae0047f5ca41b93f7f9b69e06e19e8c919a8a7307ea2556129`; initial import target `packages/sdk/src/persist-queue.ts`.
- `hyperframes-main/packages/sdk/src/adapters/fs.ts` — SHA-256 `83b9eeaeb3c86d84dbb6992b2178c85ca2f4e8742697657a89dacfb2dd0cf60c`; initial import target `packages/sdk/src/adapters/fs.ts`.
- `hyperframes-main/packages/studio-server/src/helpers/backupJournal.ts` — SHA-256 `cefd760e6f9abf8f04c197a93b9c712c0274633f3f29c7b65a79b2efc362c277`; initial import target `packages/studio-server/src/helpers/backupJournal.ts`.
- `hyperframes-main/packages/studio-server/src/helpers/fileVersion.ts` — SHA-256 `cf61ce8cd0272a0d9a1e44a9c550ab1dc1c90b518216673a15fa3c249729fecc`; initial import target `packages/studio-server/src/helpers/fileVersion.ts`.

## H-SERVER — Existing API host and project resolution

- `hyperframes-main/packages/studio-server/src/createStudioApi.ts` — SHA-256 `f591dd2ee76e21ca7fb6df3743b5445eee8b6a0ecbe6e964497268c20390ead2`; initial import target `packages/studio-server/src/createStudioApi.ts`.
- `hyperframes-main/packages/studio-server/src/types.ts` — SHA-256 `00110a3d3ef0a571e23e929734da8f3fe431169467df45e2e71f40b904a914b5`; initial import target `packages/studio-server/src/types.ts`.
- `hyperframes-main/packages/studio-server/src/routes/projects.ts` — SHA-256 `c1a9208e5e2165f957522e10ec1b3a253debb22bb21be1a2cb6cf92c35256599`; initial import target `packages/studio-server/src/routes/projects.ts`.
- `hyperframes-main/packages/cli/src/server/studioServer.ts` — SHA-256 `92e4c2d54c657950a8731ec7c9d924e602b7edb431d86664fa3ac5e5938f9914`; initial import target `packages/cli/src/server/studioServer.ts`.

## H-FILES — File edit ingress and safe path resolution

- `hyperframes-main/packages/studio-server/src/routes/files.ts` — SHA-256 `fba13bf064874866b5760af21cade41768b6a39f66652681c278dac11cddd8fd`; initial import target `packages/studio-server/src/routes/files.ts`.
- `hyperframes-main/packages/studio-server/src/helpers/safePath.ts` — SHA-256 `fa9de30c9fc0d160faf0fa8c158120981125937abd9b668fafca3d2f35bd5176`; initial import target `packages/studio-server/src/helpers/safePath.ts`.
- `hyperframes-main/packages/studio-server/src/helpers/sourceMutation.ts` — SHA-256 `0e7d8da74dbb54580278f80e735f293c1ccac55e501f624236d79421e1c5aa89`; initial import target `packages/studio-server/src/helpers/sourceMutation.ts`.
- `hyperframes-main/packages/cli/src/server/fileWatcher.ts` — SHA-256 `9056b485ff11d0dfadce30d5f7abfe5f573850903ddd6237275f803d4fd6f881`; initial import target `packages/cli/src/server/fileWatcher.ts`.

## H-ROUTES — Storyboard, preview, lint and selection endpoints

- `hyperframes-main/packages/studio-server/src/routes/storyboard.ts` — SHA-256 `bfef88b56720638a7eb5c213a3ed3d8ab9a44abad9192ab5e081b3897159cfc0`; initial import target `packages/studio-server/src/routes/storyboard.ts`.
- `hyperframes-main/packages/studio-server/src/routes/preview.ts` — SHA-256 `ebc88dca7ce9f350e98697c8949b438208bd16995c28addb0f0dce0fbf0c19a5`; initial import target `packages/studio-server/src/routes/preview.ts`.
- `hyperframes-main/packages/studio-server/src/routes/lint.ts` — SHA-256 `862a407624d194081f49e6fe904ad5499e7e1270d62070e2b6d16f71b8260805`; initial import target `packages/studio-server/src/routes/lint.ts`.
- `hyperframes-main/packages/studio-server/src/routes/selection.ts` — SHA-256 `161130146764f20545dd8f91366aa0d6eec6a9d92070613f2c29cf56c4b92b69`; initial import target `packages/studio-server/src/routes/selection.ts`.

## H-JOBS — Render and thumbnail operations

- `hyperframes-main/packages/studio-server/src/routes/render.ts` — SHA-256 `202de8e9fbd958471c483bd7b392a7b3f817d871442e56cbb157bad6271f03a5`; initial import target `packages/studio-server/src/routes/render.ts`.
- `hyperframes-main/packages/studio-server/src/routes/thumbnail.ts` — SHA-256 `1b7460980e5675ade911f7a4d31de49e63a4bf6d502fe2f5959e71e94dfd5f2d`; initial import target `packages/studio-server/src/routes/thumbnail.ts`.
- `hyperframes-main/packages/studio-server/src/routes/thumbnailGenerationCoordinator.ts` — SHA-256 `ddf46301e58aeb4b7fedcd6a47467f0dd1e219f203bb120afe1ee505ba62141a`; initial import target `packages/studio-server/src/routes/thumbnailGenerationCoordinator.ts`.

## H-SHELL — Application shell, project browser and panels

- `hyperframes-main/packages/studio/src/App.tsx` — SHA-256 `77645dae9fc04c3d34de055162b8e79a412b971b92f0bbb09d307f05ba185234`; initial import target `packages/studio/src/App.tsx`.
- `hyperframes-main/packages/studio/src/components/EditorShell.tsx` — SHA-256 `587cd990d95a6ba023548d697b75dd5d53b889be9553248f014a9bf4c6b82c97`; initial import target `packages/studio/src/components/EditorShell.tsx`.
- `hyperframes-main/packages/studio/src/components/StudioLeftSidebar.tsx` — SHA-256 `22c7c1c882fd67a24334d22e9eb6e36f15b58861dc772be512afef8d7510bcfb`; initial import target `packages/studio/src/components/StudioLeftSidebar.tsx`.
- `hyperframes-main/packages/studio/src/components/StudioRightPanel.tsx` — SHA-256 `d2ae8d69e36168f33f5db54dd1db10527dc287d0233952e385b413af833c3a85`; initial import target `packages/studio/src/components/StudioRightPanel.tsx`.
- `hyperframes-main/packages/studio/src/components/StudioHeader.tsx` — SHA-256 `04eed0110a7a388fd405ff387c4bcf15c41cf14d4033f6964434ebb66ab67991`; initial import target `packages/studio/src/components/StudioHeader.tsx`.

## H-INSPECT — Inspector and source editing UI

- `hyperframes-main/packages/studio/src/components/editor/PropertyPanel.tsx` — SHA-256 `39e33072716a28dfe28dcb59b2227a7e23bd38f45b5e8293b3ad5b1d883bd89f`; initial import target `packages/studio/src/components/editor/PropertyPanel.tsx`.
- `hyperframes-main/packages/studio/src/components/editor/SourceEditor.tsx` — SHA-256 `27ed2b73eac666c37aa644c2601641bfad20b4dd675b61718c4afc2a5fd35650`; initial import target `packages/studio/src/components/editor/SourceEditor.tsx`.
- `hyperframes-main/packages/studio/src/components/editor/LayersPanel.tsx` — SHA-256 `cda3d7032ec32ad86decdff9c21b96ab18805fda958a69ac34a511b800bfde58`; initial import target `packages/studio/src/components/editor/LayersPanel.tsx`.
- `hyperframes-main/packages/studio/src/components/editor/FileTree.tsx` — SHA-256 `8e847f14f1ff49a833e6ba3fcfdcfd08e559dbd0b8ebb5bae5d5219a44137764`; initial import target `packages/studio/src/components/editor/FileTree.tsx`.

## H-TIMELINE — Timeline controls and selection store

- `hyperframes-main/packages/studio/src/player/components/Timeline.tsx` — SHA-256 `74fd89ce3935178f2de02b4beaccecaaf22085e4f5ebb4431b18a044e8d2740d`; initial import target `packages/studio/src/player/components/Timeline.tsx`.
- `hyperframes-main/packages/studio/src/player/store/playerStore.ts` — SHA-256 `8343c5dd12d5d2541a4826c772791b7b2a7e0467a0b54f290d01430147b136e6`; initial import target `packages/studio/src/player/store/playerStore.ts`.
- `hyperframes-main/packages/studio/src/components/TimelineToolbar.tsx` — SHA-256 `76cb04cd037c12a54b8f25a64fe1e88297ba2178733bb578c362d2cde5a2a5b7`; initial import target `packages/studio/src/components/TimelineToolbar.tsx`.

## H-HISTORY — Studio history and SDK session glue

- `hyperframes-main/packages/studio/src/hooks/useStudioSdkSessions.ts` — SHA-256 `a42aa030dfe599b66c9b0aa49e29ccc99c96915e360c064d8eba08490e0e0b62`; initial import target `packages/studio/src/hooks/useStudioSdkSessions.ts`.
- `hyperframes-main/packages/studio/src/hooks/usePersistentEditHistory.ts` — SHA-256 `d237e4222ec55fe1672b3597cc6162de2ef57efedc137bfd4ab158648747fb53`; initial import target `packages/studio/src/hooks/usePersistentEditHistory.ts`.
- `hyperframes-main/packages/studio/src/utils/studioFileMutationCoordinator.ts` — SHA-256 `7be5b0ad68bf2f1416f4523e91946cfc007a28d38fc4f3d9eecbb606d8e9f04f`; initial import target `packages/studio/src/utils/studioFileMutationCoordinator.ts`.
- `hyperframes-main/packages/studio/src/components/ExternalFileConflictBanner.tsx` — SHA-256 `df7559180c33a92f7c8caca479a7785f4289e4a8fa1e55b5f0ddfd884b93b79f`; initial import target `packages/studio/src/components/ExternalFileConflictBanner.tsx`.
- `hyperframes-main/packages/studio/src/components/SaveQueuePausedBanner.tsx` — SHA-256 `5200d8e9a2f3db62daca485c49ebf2f49c383b847b6b6cdad8f882fd908405fb`; initial import target `packages/studio/src/components/SaveQueuePausedBanner.tsx`.

## H-GESTURE — Canvas transforms, hit-testing and DOM mutation

- `hyperframes-main/packages/studio/src/components/editor/DomEditOverlay.tsx` — SHA-256 `23864c1f6a2ba613a79ecc44e13205a539012f47c1b1bbb0e5437fc2e20e7a79`; initial import target `packages/studio/src/components/editor/DomEditOverlay.tsx`.
- `hyperframes-main/packages/studio/src/components/editor/domEditing.ts` — SHA-256 `8cbead729e1ab83e41d1f429b694f78e8a3e1ca35e12435b3f2b9dcd7a1a9f27`; initial import target `packages/studio/src/components/editor/domEditing.ts`.
- `hyperframes-main/packages/studio/src/components/editor/groupDragMove.ts` — SHA-256 `251e10c8b2038f9a03252cd53ea9989b286b89b1b4b2ef25301d2e1a1455a3f9`; initial import target `packages/studio/src/components/editor/groupDragMove.ts`.
- `hyperframes-main/packages/sdk/src/adapters/iframe.ts` — SHA-256 `40d71bd480356798d9dc7b033498026b419c05af9b95c9f3827ea4b2e4d6f9f3`; initial import target `packages/sdk/src/adapters/iframe.ts`.

## H-ANIMUI — Animation, paths, easing and keyframe controls

- `hyperframes-main/packages/studio/src/components/editor/GsapAnimationSection.tsx` — SHA-256 `217a51f391be7c919099dea53d430f12d8237f65510d1102a44b6ddb47e72d12`; initial import target `packages/studio/src/components/editor/GsapAnimationSection.tsx`.
- `hyperframes-main/packages/studio/src/components/editor/MotionPathOverlay.tsx` — SHA-256 `1f61cf9ee00452222c04a54703a348cada55dd5520cd76125d0eff0c802ce1b4`; initial import target `packages/studio/src/components/editor/MotionPathOverlay.tsx`.
- `hyperframes-main/packages/studio/src/components/editor/EaseCurveSection.tsx` — SHA-256 `acfea2f7bc8a4dadc1982297e7964a8613fd28210077bf88eedbf2962277eeda`; initial import target `packages/studio/src/components/editor/EaseCurveSection.tsx`.
- `hyperframes-main/packages/studio/src/components/editor/KeyframeNavigation.tsx` — SHA-256 `485c12481fb8afddd74560bba026ff17fb411b9f83b19a3dd638d7054f2d12dc`; initial import target `packages/studio/src/components/editor/KeyframeNavigation.tsx`.

## H-CAPTIONS — Caption parse, display and timeline

- `hyperframes-main/packages/studio/src/captions/parser.ts` — SHA-256 `c48b9fa26e0f5850643f8586a696037cfa01641c74dcfebc1d18656c78ba8994`; initial import target `packages/studio/src/captions/parser.ts`.
- `hyperframes-main/packages/studio/src/captions/generator.ts` — SHA-256 `13c12291df8d96da83959f548dac9f38cf7ae0669caa580a14df3d35ba89970c`; initial import target `packages/studio/src/captions/generator.ts`.
- `hyperframes-main/packages/studio/src/captions/components/CaptionTimeline.tsx` — SHA-256 `c1bc36f2c4f09d705d05048a9690ca7167d1193e6014d3252d94a33ee698d7c7`; initial import target `packages/studio/src/captions/components/CaptionTimeline.tsx`.
- `hyperframes-main/packages/studio/src/captions/hooks/useCaptionSync.ts` — SHA-256 `3b8ec18395989c287ddda5f7fa76462263c8f487bfd2537939a9fc05cfe1a108`; initial import target `packages/studio/src/captions/hooks/useCaptionSync.ts`.

## H-ASSETS — Media validation, probing and asset resolution

- `hyperframes-main/packages/studio-server/src/routes/media.ts` — SHA-256 `eab9f6472e70e2eef203846b64fedc07c2a10f7d65bbc5189ca56637afa73e30`; initial import target `packages/studio-server/src/routes/media.ts`.
- `hyperframes-main/packages/studio-server/src/helpers/mediaMetadata.ts` — SHA-256 `1b5987ce50666c61aa572f38788657d1a66f6dc4e4baa22d0a2ffbe9a1fce138`; initial import target `packages/studio-server/src/helpers/mediaMetadata.ts`.
- `hyperframes-main/packages/studio-server/src/helpers/mediaValidation.ts` — SHA-256 `36be4a6d37919ed659f50f36853716a2fbb0c1e201001e43b8aeb8ecb006e7e8`; initial import target `packages/studio-server/src/helpers/mediaValidation.ts`.
- `hyperframes-main/packages/parsers/src/assetResolution.ts` — SHA-256 `2a13518042dbb158d6f899a20766f98557f1f87a833c236cea5d299e756bc532`; initial import target `packages/parsers/src/assetResolution.ts`.
- `hyperframes-main/packages/parsers/src/assetPaths.ts` — SHA-256 `34e531976783eb70831fcce779ae911e36eebf8a33b040e12041314b387a298d`; initial import target `packages/parsers/src/assetPaths.ts`.

## H-FONTS — Font readiness and localization code (not binary redistribution)

- `hyperframes-main/packages/producer/src/services/deterministicFonts.ts` — SHA-256 `2f2e85f7ce55ca09b89a6e033856ab5d3715ca1317c3e37441a1f8fe236fbb1a`; initial import target `packages/producer/src/services/deterministicFonts.ts`.
- `hyperframes-main/packages/cli/src/fontLocalize.ts` — SHA-256 `184577cf19fb2b5afe8d2a16e303fb24503e6c97070b44639e2991bc2bc4e0ab`; initial import target `packages/cli/src/fontLocalize.ts`.
- `hyperframes-main/packages/studio-server/src/routes/fonts.ts` — SHA-256 `72a2bdad3d27eede281b2a319817ba7da28471a196aabccdc1bdcb741ffdc486`; initial import target `packages/studio-server/src/routes/fonts.ts`.
- `hyperframes-main/packages/cli/src/capture/captureFontValidation.ts` — SHA-256 `398199b1376276dcea0ae5df02cefd4067f0076fc63cffcabc06daeb493c01b4`; initial import target `packages/cli/src/capture/captureFontValidation.ts`.

## H-PRODUCER — Retained render pipeline

- `hyperframes-main/packages/producer/src/index.ts` — SHA-256 `6b4823fd87e13c7bd84923ba8c5687529f54dcd951eb93479b5e77c65c50d73d`; initial import target `packages/producer/src/index.ts`.
- `hyperframes-main/packages/producer/src/renderRequest.ts` — SHA-256 `2a9a9faac44385d381be015138febeb15c1831b199878fcef28854174b28a617`; initial import target `packages/producer/src/renderRequest.ts`.
- `hyperframes-main/packages/producer/src/services/renderOrchestrator.ts` — SHA-256 `dfba15ed54c652871f65176f2c2c104eca1688911c9de45e3fe6b72747459700`; initial import target `packages/producer/src/services/renderOrchestrator.ts`.
- `hyperframes-main/packages/producer/src/services/compilationRunner.ts` — SHA-256 `84125bd495ca5ef3b9d0b2dbbbff9365b89c9744e5d32e76299d6dffc936d397`; initial import target `packages/producer/src/services/compilationRunner.ts`.

## H-CAPTURE — Frame capture and encoding

- `hyperframes-main/packages/engine/src/services/frameCapture.ts` — SHA-256 `a98b45776beea33321da68a0fff72f01333289a54f1b1c6de6b29f0a532252e5`; initial import target `packages/engine/src/services/frameCapture.ts`.
- `hyperframes-main/packages/engine/src/services/chunkEncoder.ts` — SHA-256 `ef277f555f5bd6d53f84c1823458ff5eb0e2d3f50a4bdb8b840db25488cb4605`; initial import target `packages/engine/src/services/chunkEncoder.ts`.
- `hyperframes-main/packages/engine/src/services/streamingEncoder.ts` — SHA-256 `658ba3e524145a79012a86225b860b65e65afd7820a923ea6b31e7716ef3800d`; initial import target `packages/engine/src/services/streamingEncoder.ts`.
- `hyperframes-main/packages/engine/src/utils/renderProvenance.ts` — SHA-256 `ad73449069b07006f78d9345fb7bc68414cde7281b55e55a411c8fa0e7133cdf`; initial import target `packages/engine/src/utils/renderProvenance.ts`.

## H-AUDIO — Audio mixer, timing and effects

- `hyperframes-main/packages/producer/src/services/audioMixer.ts` — SHA-256 `43c84e3e049ad999309b544f0fd8d6bc09855643522b22f72a2f8ec609df8359`; initial import target `packages/producer/src/services/audioMixer.ts`.
- `hyperframes-main/packages/engine/src/services/audioMixer.ts` — SHA-256 `990d3e83ff41dd05f9a365dc941bb585fe5ea8d8b7bf5e2f66ab79e4af97a1d8`; initial import target `packages/engine/src/services/audioMixer.ts`.
- `hyperframes-main/packages/core/src/audioFx.ts` — SHA-256 `b6241a59319aea8a1823e90ebcd8d347399d31ee6d49aecd0f2b8d012df848de`; initial import target `packages/core/src/audioFx.ts`.
- `hyperframes-main/packages/engine/src/services/audioVolumeEnvelope.ts` — SHA-256 `6fe7f6a5d4af2d850f8da29669e534c7ae33d8f76a5927e84757b7792854230c`; initial import target `packages/engine/src/services/audioVolumeEnvelope.ts`.

## H-PARITY — Existing producer conformance and regressions

- `hyperframes-main/packages/producer/src/runtime-conformance.ts` — SHA-256 `da84389739556cb25477297536b383b435c66690a99fdeb405fd42c10f068bc4`; initial import target `packages/producer/src/runtime-conformance.ts`.
- `hyperframes-main/packages/producer/src/parity-harness.ts` — SHA-256 `65d278c2ad9dfaa04559b07f0f40a8a352c1bcf433c4a955024239092d13a723`; initial import target `packages/producer/src/parity-harness.ts`.
- `hyperframes-main/packages/producer/src/regression-harness.ts` — SHA-256 `ff09e6a9fbeb78d87a5c18b0be7b5704cfbe788753440b6abfe7c4b7fa504ceb`; initial import target `packages/producer/src/regression-harness.ts`.
- `hyperframes-main/packages/producer/src/perf-gate.ts` — SHA-256 `7f7bcc321502a9a80ecbe412b044d3a835454b3fede39117026ee9097666689f`; initial import target `packages/producer/src/perf-gate.ts`.

## H-PROCESS — Worker lifecycle, resource and process tracking

- `hyperframes-main/packages/engine/src/utils/managedChildProcess.ts` — SHA-256 `e8bad66ad2250b840d107edbf43ecf1a81a1d29dac46773629b94a95b8365a8e`; initial import target `packages/engine/src/utils/managedChildProcess.ts`.
- `hyperframes-main/packages/engine/src/utils/processTracker.ts` — SHA-256 `c664b327f8bbd5dcbe002e9895a670e24dbd2c130d18dcd9758ca2cfb37081fe`; initial import target `packages/engine/src/utils/processTracker.ts`.
- `hyperframes-main/packages/engine/src/services/browserManager.ts` — SHA-256 `a205e0b30cac10f1156a323d8c9838dfdd91598bd1c7146622b0d657680d2d06`; initial import target `packages/engine/src/services/browserManager.ts`.
- `hyperframes-main/packages/engine/src/services/systemMemory.ts` — SHA-256 `71e02471d7a8bbedcf9bc833df5bdc09bae7d28be2839f966ecf4b24a756f2a2`; initial import target `packages/engine/src/services/systemMemory.ts`.

## H-CLI — Main CLI, init, preview and doctor

- `hyperframes-main/packages/cli/src/cli.ts` — SHA-256 `3901a610a932d1e9152c628e4501e45f7baa73205dac92dc5cba6b810b284a5d`; initial import target `packages/cli/src/cli.ts`.
- `hyperframes-main/packages/cli/src/commands/init.ts` — SHA-256 `7e640bb1f7e8f1770914e5f7dbcc275e4af58bb1ab125388442edb551a3814bf`; initial import target `packages/cli/src/commands/init.ts`.
- `hyperframes-main/packages/cli/src/commands/preview.ts` — SHA-256 `a4fb2bdae4919ff32c0bd22fab3035f4191fba584a4a629e40fe321714bfd2b2`; initial import target `packages/cli/src/commands/preview.ts`.
- `hyperframes-main/packages/cli/src/commands/doctor.ts` — SHA-256 `d20109edb09d316237a387cceaafbd8b90d01ace255f99a43dbe4a15ea26d6be`; initial import target `packages/cli/src/commands/doctor.ts`.
- `hyperframes-main/packages/cli/src/help.ts` — SHA-256 `c98ac90cfc02a070da7b4eca33e126fa01191aa372052c62f79407357cb3274f`; initial import target `packages/cli/src/help.ts`.

## H-TOOLS — Studio agent tool registration and write coordination

- `hyperframes-main/packages/studio/src/webmcp/StudioAgentTools.tsx` — SHA-256 `e0243ad3094049d74f9ce66178baffa1ce89a33628943dbaabe518f991acabdc`; initial import target `packages/studio/src/webmcp/StudioAgentTools.tsx`.
- `hyperframes-main/packages/studio/src/webmcp/registrar.ts` — SHA-256 `b651f642440861fe9e6b561c224c29700aba2658d90d5415ec2c1adcd3afa503`; initial import target `packages/studio/src/webmcp/registrar.ts`.
- `hyperframes-main/packages/studio/src/webmcp/writeCoordinator.ts` — SHA-256 `ebf24b5ec01d5a01f59cd5f0a23a60ea81352a57955c992b15956e4c1f7a3c13`; initial import target `packages/studio/src/webmcp/writeCoordinator.ts`.
- `hyperframes-main/packages/studio/src/webmcp/tools/contentTools.ts` — SHA-256 `f91f7c4c025b94d952c715e52cdf61cb9f56de1efd1383aa0382df0ab1458169`; initial import target `packages/studio/src/webmcp/tools/contentTools.ts`.

## H-SKILL — Coding agent instructions and bundled skills

- `hyperframes-main/AGENTS.md` — SHA-256 `9967a8f5058966c33a46877088e65e1f0e0313842b652b61da346bca33b42fe8`; initial import target `docs/upstream/hyperframes/agent-config/AGENTS.md`.
- `hyperframes-main/CLAUDE.md` — SHA-256 `8dffa6ae9fb4ea4406e083a417e011ceb66dae998aa354211b4cd91359176157`; initial import target `docs/upstream/hyperframes/agent-config/CLAUDE.md`.
- `hyperframes-main/skills/pr-to-video/SKILL.md` — SHA-256 `d5661b3dc501a1439b56de6b90cc00c7ea295623feb902935e2e1230b111ed42`; initial import target `skills/pr-to-video/SKILL.md`.
- `hyperframes-main/skills-manifest.json` — SHA-256 `3c2b9ca77b49c52d33434af0d3a9a954d8b742574a82b04b96d8fddd39f3e68b`; initial import target `skills-manifest.json`.
- `hyperframes-main/scripts/check-skill-mirror.mjs` — SHA-256 `34c294bf437c4056eb2e24d7fb7b72f41071b9a9cc87506e46b848082b2529b1`; initial import target `scripts/check-skill-mirror.mjs`.

## H-PROVIDERS — Optional speech, transcription and local model adapters

- `hyperframes-main/packages/cli/src/audio/providers.ts` — SHA-256 `f2588e23a9d320f9938ff0ffeb6c36b499b2e6260b853019a0c202f316d5f5cf`; initial import target `packages/cli/src/audio/providers.ts`.
- `hyperframes-main/packages/cli/src/commands/tts.ts` — SHA-256 `609825ce329e28a8bc1a31003250c7ddd5f1ce813439e93b3d7a8ff10788b45f`; initial import target `packages/cli/src/commands/tts.ts`.
- `hyperframes-main/packages/cli/src/commands/transcribe.ts` — SHA-256 `0a035d2a56d66c2e34f8282ad9b1fe3a91993f5b77a67cb9ae509e03e781baa8`; initial import target `packages/cli/src/commands/transcribe.ts`.
- `hyperframes-main/packages/cli/src/tts/synthesize.ts` — SHA-256 `eb6d9aac01f16ccdcf91d1328e9ead26ad85cd0cd6606bbe4afc7b4aa11a9707`; initial import target `packages/cli/src/tts/synthesize.ts`.
- `hyperframes-main/packages/cli/src/whisper/transcribe.ts` — SHA-256 `d01f963d50052d2ea9462c5830503ea94c8f3256691fd735c3e8c430592139c8`; initial import target `packages/cli/src/whisper/transcribe.ts`.

## H-NET — Update, telemetry and outbound network controls

- `hyperframes-main/packages/cli/src/telemetry/policy.ts` — SHA-256 `49f0ae969527acbc86541b955d2b3962ad00bb07e096a810b39782938808a558`; initial import target `packages/cli/src/telemetry/policy.ts`.
- `hyperframes-main/packages/cli/src/telemetry/transport.ts` — SHA-256 `99ea9ed9273b23b2fa6cddda088b7b61be4d51dd82f6181bd6c94bdf145aa4f8`; initial import target `packages/cli/src/telemetry/transport.ts`.
- `hyperframes-main/packages/cli/src/utils/autoUpdate.ts` — SHA-256 `de05268ce420e61eeb755ad5ec83189d129dbbf2d0054fd9eb27df83b4322df3`; initial import target `packages/cli/src/utils/autoUpdate.ts`.
- `hyperframes-main/packages/cli/src/utils/updateCheck.ts` — SHA-256 `8149142c9d8d3cb933092c9cc8768ea1dc6f00f8ad10eb8cf8b2b31d0d599cbb`; initial import target `packages/cli/src/utils/updateCheck.ts`.
- `hyperframes-main/packages/engine/src/utils/urlDownloader.ts` — SHA-256 `75d024cd7f90023ee9dd7830a3d0275d869797ea7ec7fcff1774e5f2cd1a8b45`; initial import target `packages/engine/src/utils/urlDownloader.ts`.

## H-AUTH — Optional hosted authentication and secret scrubbing

- `hyperframes-main/packages/cli/src/auth/resolver.ts` — SHA-256 `cc9715af9d76d69a31525794c4a76d81f324945a916219cae27ff906ce707617`; initial import target `packages/cli/src/auth/resolver.ts`.
- `hyperframes-main/packages/cli/src/auth/store.ts` — SHA-256 `85a372a8df4a96a3b878aaa7c8ec1d86eed0e3636f939fd81f155d0f2cd9a908`; initial import target `packages/cli/src/auth/store.ts`.
- `hyperframes-main/packages/cli/src/auth/scrub.ts` — SHA-256 `54c5f174cd62ef73f8cf95d43fb5976d1b6b5e19583224488e2e9e52c3fa5d1b`; initial import target `packages/cli/src/auth/scrub.ts`.
- `hyperframes-main/packages/cli/src/cloud/auth.ts` — SHA-256 `1b8d9991da9b57f9a2a9a4b67870c72a90807fafdcfd5d3dc57af8ef912eac92`; initial import target `packages/cli/src/cloud/auth.ts`.

## H-CATALOG — Registry install, local resolution and template access

- `hyperframes-main/packages/cli/src/registry/installer.ts` — SHA-256 `406e1535fe968a912ce690510b3eda39b331224f253374c41bd5fe28a9d727f1`; initial import target `packages/cli/src/registry/installer.ts`.
- `hyperframes-main/packages/cli/src/registry/remote.ts` — SHA-256 `e8066f5f833913ffe7594e969729bb61bb72b800487b56b24d2a990d9df7e493`; initial import target `packages/cli/src/registry/remote.ts`.
- `hyperframes-main/packages/cli/src/registry/resolver.ts` — SHA-256 `9c269f8193b9086f51c648f487c45e94e45975aa5e21d4b004e514c225f9daaa`; initial import target `packages/cli/src/registry/resolver.ts`.
- `hyperframes-main/packages/studio-server/src/routes/registry.ts` — SHA-256 `d9d6a980d2889772a1a61fb5f01be45b860da63e36f9a67b06ba3c0d81711cd6`; initial import target `packages/studio-server/src/routes/registry.ts`.
- `hyperframes-main/packages/cli/src/templates/remote.ts` — SHA-256 `60088c9c52d293a90b17508d970ed5fff1ba6939bf36b1ed6f5ca198305346b6`; initial import target `packages/cli/src/templates/remote.ts`.

## H-EXTERNAL — Existing optional capture, Figma and publishing commands

- `hyperframes-main/packages/cli/src/commands/capture.ts` — SHA-256 `4dbc0738cf3a2cac325c7f3439acef923c4265cdc1d4b5ebb03f39c56f6bbf4d`; initial import target `packages/cli/src/commands/capture.ts`.
- `hyperframes-main/packages/cli/src/commands/figma.ts` — SHA-256 `649d5a056c2e0ebcf84414a41be39f2ea8da5b9df8c4d52a41c42ba659727d16`; initial import target `packages/cli/src/commands/figma.ts`.
- `hyperframes-main/packages/cli/src/commands/publish.ts` — SHA-256 `fa8edc7c68c5be26b98b8529aa5ca0f86f730113c6f3190efefab4f1482d61d9`; initial import target `packages/cli/src/commands/publish.ts`.
- `hyperframes-main/packages/cli/src/commands/remove-background.ts` — SHA-256 `d6c6a9c4d9b1483ad0d374be988bfeaba181eeeeb646894c4cef53242f7a85e9`; initial import target `packages/cli/src/commands/remove-background.ts`.

## H-CLOUD — Optional deployment adapters and container packaging

- `hyperframes-main/packages/aws-lambda/src/index.ts` — SHA-256 `82c9b226f79a9a3d336bc4610c990668719ca8c2f2e5c03926c2bbfab365282e`; initial import target `packages/aws-lambda/src/index.ts`.
- `hyperframes-main/packages/gcp-cloud-run/package.json` — SHA-256 `6ab9c4452647ccc12becd03d1cbb27ebba14ba754ec8318a3bcd1c8f1781098b`; initial import target `packages/gcp-cloud-run/package.json`.
- `hyperframes-main/packages/cli/src/docker/Dockerfile.render` — SHA-256 `efafd83b9ddb0ca97b0030af66c29c57a7b4265c1b062544d78ba5d6268903f1`; initial import target `packages/cli/src/docker/Dockerfile.render`.
- `hyperframes-main/packages/cli/src/commands/cloudrun.ts` — SHA-256 `e98740f4a9dc7f265492da9692b8b624eec3cd0b84a054976cf731ca8b2abcdb`; initial import target `packages/cli/src/commands/cloudrun.ts`.
- `hyperframes-main/packages/cli/src/commands/lambda.ts` — SHA-256 `7b1b71aae6fb611f29faf7bc30500e90c456afd97d559bdafa3b059b1a13cf51`; initial import target `packages/cli/src/commands/lambda.ts`.

## H-PLAYER — Player and slideshow compatibility

- `hyperframes-main/packages/player/src/hyperframes-player.ts` — SHA-256 `d258513c49f0c8f2c9a8817c49b5b9d7266d0280641918673aa6e450be71ff74`; initial import target `packages/player/src/hyperframes-player.ts`.
- `hyperframes-main/packages/player/src/slideshow/hyperframes-slideshow.ts` — SHA-256 `270d8ae170b34b7803d52132c6fed4c0acc9d6baf2e75d377eed9dc99708bd0f`; initial import target `packages/player/src/slideshow/hyperframes-slideshow.ts`.
- `hyperframes-main/packages/player/src/runtime-message-handler.ts` — SHA-256 `329d85768ebbade3037d92815be66cc36ef9b88c8775d7768ca940a3ead9e0ee`; initial import target `packages/player/src/runtime-message-handler.ts`.
- `hyperframes-main/packages/player/src/media-element-guards.ts` — SHA-256 `67ac9d77d227713fb936c29c8f6283d4bea5d6472254dd7b09fcbae9c09e9fb9`; initial import target `packages/player/src/media-element-guards.ts`.

## H-STYLE — Existing themes and native animated graph reference

- `hyperframes-main/themes/CONTRACT.md` — SHA-256 `c189c7afa0d301fc1e8facb45d8c7495b6b2b3c66245539423f024a38864952b`; initial import target `themes/CONTRACT.md`.
- `hyperframes-main/themes/editorial.css` — SHA-256 `7f7736893c8aee33a8b05f05c8a5be1ca2f733d6b31f723c662e0b0cce4cf78c`; initial import target `themes/editorial.css`.
- `hyperframes-main/registry/blocks/flowchart/flowchart.html` — SHA-256 `c5432d04f4f720de031377a35fbf07f1c2cbee72b04b40f7b79b0e26f5fd63bc`; initial import target `registry/blocks/flowchart/flowchart.html`.
- `hyperframes-main/registry/blocks/flowchart-vertical/flowchart-vertical.html` — SHA-256 `35b54ecdd282e83beb464276483dc633c64a7e47138447b2b5642df463cfc548`; initial import target `registry/blocks/flowchart-vertical/flowchart-vertical.html`.

## H-PACK — Release preparation and packed package verification

- `hyperframes-main/scripts/release-prepare.ts` — SHA-256 `a5ad53b71b52f6c2b4069bb0f8c5d53c7b3c291a2a9eb1d170d370a9a621e1d3`; initial import target `scripts/release-prepare.ts`.
- `hyperframes-main/scripts/set-version.ts` — SHA-256 `328e94ba12c2edfae4ea68cb3f17bee51b4a73bec4d8b9a844ae559f97081371`; initial import target `scripts/set-version.ts`.
- `hyperframes-main/scripts/verify-packed-manifests.mjs` — SHA-256 `28907f6ade1f24e1a9aff1afcd3a9db5e1538d1f834e1ec6d10b6e6fda9ae08f`; initial import target `scripts/verify-packed-manifests.mjs`.
- `hyperframes-main/scripts/studio-runtime-smoke.mjs` — SHA-256 `7ec025162847affd356dbbf74e4302c14d855f861ed4221455a0070e1107389a`; initial import target `scripts/studio-runtime-smoke.mjs`.
- `hyperframes-main/scripts/package-subpaths.mjs` — SHA-256 `c32e314b62110489db85128fc0197f307e5e7dc289877f398675a0ed18b576d5`; initial import target `scripts/package-subpaths.mjs`.
