/** Small, valid WAV fixtures; no encoder or installed browser required. */
export interface WavFixtureOptions {
  float?: boolean;
  extensible?: boolean;
  channels?: number;
  sampleRate?: number;
  frames?: number;
  values?: number[];
  dataFirst?: boolean;
  oddJunk?: boolean;
}

export function wavFormatFixture(options: WavFixtureOptions = {}) {
  const float = options.float ?? true;
  const channels = options.channels ?? 2;
  const sampleRate = options.sampleRate ?? 48000;
  const bytesPerSample = float ? 4 : 2;
  const frames = options.frames ?? 4;
  const fmt = Buffer.alloc(options.extensible === false ? 16 : 40);
  fmt.writeUInt16LE(options.extensible === false ? (float ? 3 : 1) : 0xfffe, 0);
  fmt.writeUInt16LE(channels, 2);
  fmt.writeUInt32LE(sampleRate, 4);
  fmt.writeUInt32LE(sampleRate * channels * bytesPerSample, 8);
  fmt.writeUInt16LE(channels * bytesPerSample, 12);
  fmt.writeUInt16LE(bytesPerSample * 8, 14);
  if (options.extensible !== false) {
    fmt.writeUInt16LE(22, 16);
    fmt.writeUInt16LE(bytesPerSample * 8, 18);
    // Zero denotes unspecified speaker assignment. Sample channel order is unchanged.
    fmt.writeUInt32LE(0, 20);
    Buffer.from(
      float ? "0300000000001000800000aa00389b71" : "0100000000001000800000aa00389b71",
      "hex",
    ).copy(fmt, 24);
  }
  const payload = Buffer.alloc(frames * channels * bytesPerSample);
  for (let frame = 0; frame < frames; frame++) {
    for (let channel = 0; channel < channels; channel++) {
      const value = options.values?.[channel] ?? (float ? 1.4 : 14000);
      const offset = (frame * channels + channel) * bytesPerSample;
      if (float) payload.writeFloatLE(value, offset);
      else payload.writeInt16LE(value, offset);
    }
  }
  const chunk = (name: string, bytes: Buffer) => {
    const header = Buffer.alloc(8);
    header.write(name, 0, "ascii");
    header.writeUInt32LE(bytes.length, 4);
    return Buffer.concat([header, bytes, Buffer.alloc(bytes.length % 2)]);
  };
  const chunks = options.dataFirst
    ? [chunk("data", payload), chunk("fmt ", fmt)]
    : [chunk("fmt ", fmt), chunk("data", payload)];
  if (options.oddJunk) chunks.unshift(chunk("JUNK", Buffer.from([1])));
  const header = Buffer.alloc(12);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(4 + chunks.reduce((n, c) => n + c.length, 0), 4);
  header.write("WAVE", 8, "ascii");
  const bytes = Buffer.concat([header, ...chunks]);
  const offset = (wanted: string) => {
    let at = 12;
    while (at + 8 <= bytes.length) {
      const size = bytes.readUInt32LE(at + 4);
      if (bytes.toString("ascii", at, at + 4) === wanted) return at + 8;
      at += 8 + size + (size % 2);
    }
    throw new Error(`Fixture has no ${wanted} chunk`);
  };
  return { bytes, fmtOffset: offset("fmt "), dataOffset: offset("data"), fmtSize: fmt.length };
}
