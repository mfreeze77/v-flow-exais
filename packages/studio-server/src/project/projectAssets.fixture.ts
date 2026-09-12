/** Small real local media for ownership tests; no downloads or providers. */
export function wavAssetFixture(seconds = 2, sample = 0): Buffer {
  const sampleRate = 48000;
  const data = Buffer.alloc(sampleRate * seconds * 2);
  for (let offset = 0; offset < data.length; offset += 2) data.writeInt16LE(sample, offset);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/** Valid 1x1 PNG with one decoded image frame. */
export function pngAssetFixture(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGMQqTgBAAH4AVXJRJqUAAAAAElFTkSuQmCC",
    "base64",
  );
}
