/** Sample formats supported by the envelope baker and the audio FX reader.
 * WAVE_FORMAT_EXTENSIBLE describes its actual encoding with a 16-byte GUID;
 * the outer tag 0xfffe is not itself an integer or float sample format.
 */
export interface SupportedWavFormat {
  format: 1 | 3;
  channels: number;
  sampleRate: number;
  bits: 16 | 32;
  float: boolean;
}

const EXTENSIBLE_FORMAT = 0xfffe;
// On-disk little-endian GUIDs: KSDATAFORMAT_SUBTYPE_PCM / IEEE_FLOAT.
const PCM_SUBFORMAT = Buffer.from("0100000000001000800000aa00389b71", "hex");
const FLOAT_SUBFORMAT = Buffer.from("0300000000001000800000aa00389b71", "hex");

/** Validate only a complete fmt chunk, never bytes borrowed from the next chunk.
 * Supported: full-width signed PCM16 and IEEE float32. Reduced valid-bit widths,
 * compressed codecs, unknown GUIDs and incomplete extensions remain unsupported.
 * This does not validate the rest of the RIFF container or rewrite its metadata.
 */
export function readSupportedWavFormat(
  buffer: Buffer,
  body: number,
  size: number,
): SupportedWavFormat | null {
  if (
    !Number.isSafeInteger(body) ||
    !Number.isSafeInteger(size) ||
    body < 0 ||
    size < 16 ||
    body > buffer.length ||
    size > buffer.length - body
  )
    return null;

  let format = buffer.readUInt16LE(body);
  const bits = buffer.readUInt16LE(body + 14);
  if (format === EXTENSIBLE_FORMAT) {
    if (size < 40) return null;
    const extensionSize = buffer.readUInt16LE(body + 16);
    if (extensionSize < 22 || extensionSize > size - 18) return null;
    const validBits = buffer.readUInt16LE(body + 18);
    if (validBits !== bits) return null;
    const subformat = buffer.subarray(body + 24, body + 40);
    if (subformat.equals(PCM_SUBFORMAT)) format = 1;
    else if (subformat.equals(FLOAT_SUBFORMAT)) format = 3;
    else return null;
  }

  if (!((format === 1 && bits === 16) || (format === 3 && bits === 32))) return null;
  const channels = buffer.readUInt16LE(body + 2);
  const sampleRate = buffer.readUInt32LE(body + 4);
  if (channels < 1 || sampleRate < 1) return null;
  return {
    format: format as 1 | 3,
    channels,
    sampleRate,
    bits: bits as 16 | 32,
    float: format === 3,
  };
}
