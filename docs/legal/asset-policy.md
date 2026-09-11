# Asset rights policy

**Status:** accepted for local use; unresolved for distribution
**Date:** 2026-09-10
**Ticket:** AFM-004

AFM-004 requires that "release asset inclusion has a rights decision rather than
assuming source licenses cover media." This is that decision.

## The distinction

Archify is MIT and HyperFrames is Apache-2.0. Both cover **source code**.
Neither grants rights to a font file, a logo, a stock video or a hosted catalog
payload that happens to sit in the same repository. Conflating the two is the
most common licensing mistake in a fork, and it is the one this document exists
to prevent.

## What was imported

The import ledger classified assets separately from code:

| Disposition | Count | Meaning |
|---|---|---|
| `rights-review-media` | 473 | Images, video, audio and 3D models needing a decision |
| `rights-review-font-no-binary-in-ticket-pack` | 102 | Font payloads |

Across the whole tree that is roughly 164 font files and several hundred media
files, including PNG (263), MP4 (91), JPG (61) and MP3 (24).

## Fonts need attention before any distribution

The vendored font families are **not** uniformly open. Alongside open families
(Noto, Anton, Audiowide and other Google-hosted faces, plus hash-named cache
entries) the tree contains commercially licensed families, notably:

- `TT_Norms_Pro` (TypeType) — commercial, licensed per-use
- `ABCSolarDisplay` (ABC Dinamo) — commercial, licensed per-use

These arrived inside upstream skill assets. A commercial desktop or web font
licence generally does **not** permit redistribution inside a source
repository, and a licence held by the upstream author does not transfer.

## Decision

1. **Local use: proceed.** This build is local and single-user, and renders use
   the Debian-packaged open families installed in the container image
   (Liberation, Noto, DejaVu, FreeFont), not the vendored commercial files. No
   redistribution occurs.
2. **Distribution: blocked pending review.** Before this repository or any
   release artifact is published or shared, every file under
   `rights-review-font-*` and `rights-review-media` needs a per-family
   determination: keep with proof of licence, replace with an open equivalent,
   or remove.
3. **Render pipeline must not depend on a commercial font.** The container
   installs open families and the producer generates deterministic font data
   from them. A composition that requires `TT_Norms_Pro` is a portability defect
   as well as a licensing one.
4. **No font binaries in evidence bundles.** Ticket receipts and gate evidence
   must never embed a font payload. Enforced by
   `tools/legal/asset-audit.ts`; currently 0.

## Licence for new code written here

New code in this repository is **Apache-2.0**, matching the workspace
foundation. Original copyright headers in imported files are preserved; a
rebrand never strips them.

## Re-checking

```sh
bun run audit:assets
```

Writes `provenance/asset-audit.json` and `provenance/modification-ledger.json`.
It fails on a missing licence record, a font binary in `evidence/`, or a file
that diverges from upstream bytes without a recorded reason.
