# Engine media compatibility: explicit fixtures and extensible WAV

Base: `a00fc69d6fd118468824e8c8f6e441444058a7d9`.
Implementation contribution, not a ticket closure or a passing root-gate receipt.

## Four metadata failures share one unavailable image

Engine `ffprobe.test.ts` referenced the producer HDR photograph four times.
The tracked bytes at this base are a 129-byte Git LFS pointer with object hash
`ba30a9ccd79bd7f283c9d3d7ec273513e95dc45bf3b9660c0a4f8463d6b523fa`.
The PNG and completeness readers are right to refuse that text as a PNG.

The engine cases now use their own complete RGB16/PQ image. Their assertions
still check metadata, missing-binary fallback, and probe profile classification.
No production ffprobe logic, input separator, cancellation, cache, redaction,
CRC rejection or completeness check was relaxed. The producer pointer remains
unchanged; these tests do NOT validate or replace its visual golden.

## Classic and extensible sample formats

`WAVE_FORMAT_EXTENSIBLE` (0xfffe) is a wrapper. The full 16-byte SubFormat GUID
identifies PCM or IEEE float; treating 65534 as an unknown sample encoding rejects
otherwise supported audio. FFmpeg 5.1's WAV writer selects this wrapper for
sample widths greater than 16 bits, including the group's pcm_f32le output.

`wavFormat.ts` is the shared bounded fmt reader for audioVolumeEnvelope and
AudioFxRender. It handles full-width PCM16 and IEEE float32, with either classic
or extensible headers. It validates the declared fmt boundary, extension size,
full GUID, valid-bit width, channels and sample rate. Unknown GUIDs, truncated
extensions, reduced valid-bit widths, compressed codecs, PCM24/PCM32 and float64
remain unsupported. It does not claim to validate all RIFF structure, channel
mask semantics or arbitrary malformed media; data-range handling remains with
the existing readers. The FX reader no longer invents a format when fmt is absent.

Samples remain interleaved in the same order. Floating headroom above +1 or below
-1 is retained before downstream faders/FX. The envelope baker modifies only
samples and preserves container bytes outside the sample payload, using the
same private staging directory and same-filesystem rename. Its failure contract
and cleanup behavior are unchanged. The existing FX writer still emits its
classic header; this contribution does not promise channel-mask round trips.

The existing real-FFmpeg envelope case now independently accepts either classic
float tag 3 or a complete extensible IEEE_FLOAT GUID. It still asserts successful
baking and the tail sample's attenuation. The grouping tests, levels, tolerances,
AAC encoder, mix topology, limiter and browser graph were not changed.

## Verification boundary

The supplied isolated Node runner executes source test callbacks with explicit
Vitest-to-Node adaptation and module seams. Real filesystem and FFmpeg probes are
used where stated. It is not the actual Vitest module runner, pinned Docker,
headless-browser FX graph, or complete engine suite. Do not reuse its count as a
root test:unit pass. Run the original grouping and FX suites in the pinned image.

Known PropertyPanel/Timeline failures, producer HDR LFS recovery and the managed
Studio editing/export journey remain separate. Preserve source/fallback runtime
identity in future browser evidence; this engine repair does not diagnose the
Vite ssrLoadModule stall.

Primary format references:
- https://learn.microsoft.com/en-us/windows/win32/api/mmreg/ns-mmreg-waveformatextensible
- https://ffmpeg.org/doxygen/5.1/riffenc_8c_source.html (ff_put_wav_header)
