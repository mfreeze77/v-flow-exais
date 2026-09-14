# Engine-owned HDR metadata fixture

`hdr-pq-metadata.png` is a synthetic 2 x 2 RGB16 PNG, 110 bytes. It is not a
replacement photo, visual golden, or recovery of an upstream LFS object.
The test contract is metadata fallback plus complete decodable image structure.

IHDR: width 2, height 2, bit depth 16, truecolor, no interlace.
The cICP payload is `[9, 16, 0, 1]`: BT.2020 primaries, PQ transfer, identity
matrix/RGB and full range. IDAT contains two unfiltered scanlines, a stored
DEFLATE block and its zlib Adler checksum. Each PNG chunk has a valid CRC.
The four RGB16 pixels in network byte order are:

```text
40008000c000 ffff00008000
200040008000 8000c000ffff
```

SHA-256: `a378739e60368f245e7f046cabe38e9cd9399ab883a9b2973be57af88fb3c665`.
The entire file can be reproduced without image software:

```js
import { writeFileSync } from "node:fs";
writeFileSync(
  "hdr-pq-metadata.png",
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACEAIAAACtREYwAAAABGNJQ1AJEAABTSMj/gAAACVJREFUeAEBGgDl/wBAAIAAwAD//wAAgAAAIABAAIAAgADAAP//XvIIHczkqf4AAAAASUVORK5CYII=",
    "base64",
  ),
);
```

`hdrMetadataFixture.test.ts` independently checks the signature, hash, chunk
order, CRCs, decompressed pixel bytes, and (when FFmpeg is installed) the real
decoder's output. `.gitattributes` keeps these small fixture bytes out of LFS.

The producer's `tests/hdr-regression/src/hdr-photo-pq.png` is intentionally
untouched. At contribution base a00fc69 it is an LFS pointer, not image data.
Producer visual/HDR acceptance still needs that original object restored and
verified against its recorded LFS object hash. Do not substitute this tiny
metadata fixture for that visual golden or claim it was recovered.
