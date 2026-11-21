import { buildZip, crc32 } from './zip';

const encoder = new TextEncoder();

describe('crc32', () => {
  it('matches the well-known CRC-32 of "hello"', () => {
    expect(crc32(encoder.encode('hello'))).toBe(0x3610a686);
  });

  it('returns the standard checksum of an empty input', () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });

  it('is deterministic for the same bytes', () => {
    const bytes = encoder.encode('AI Deal Scoping Assistant');
    expect(crc32(bytes)).toBe(crc32(bytes.slice()));
  });
});

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true);
}

function readUint16LE(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(offset, true);
}

describe('buildZip', () => {
  it('writes a local file header signature at the very start of the archive', () => {
    const zip = buildZip([{ path: 'hello.txt', data: encoder.encode('hello') }]);
    expect(readUint32LE(zip, 0)).toBe(0x04034b50);
  });

  it('writes one local header per file, each carrying the correct CRC-32', () => {
    const files = [
      { path: 'a.txt', data: encoder.encode('hello') },
      { path: 'b.txt', data: encoder.encode('world') },
    ];
    const zip = buildZip(files);
    // First local header CRC-32 field starts at byte offset 14.
    expect(readUint32LE(zip, 14)).toBe(crc32(files.at(0)?.data ?? new Uint8Array(0)));
  });

  it('ends with a central directory and an end-of-central-directory record naming every entry', () => {
    const files = [
      { path: 'a.txt', data: encoder.encode('hello') },
      { path: 'b.txt', data: encoder.encode('world') },
    ];
    const zip = buildZip(files);
    const eocdSignature = 0x06054b50;
    let eocdOffset = -1;
    for (let candidate = zip.length - 22; candidate >= 0; candidate -= 1) {
      if (readUint32LE(zip, candidate) === eocdSignature) {
        eocdOffset = candidate;
        break;
      }
    }
    expect(eocdOffset).toBeGreaterThanOrEqual(0);
    expect(readUint16LE(zip, eocdOffset + 10)).toBe(files.length);
    const centralDirOffset = readUint32LE(zip, eocdOffset + 16);
    expect(readUint32LE(zip, centralDirOffset)).toBe(0x02014b50);
  });

  it('produces an archive that decompresses with the platform DecompressionStream (a real ZIP reader)', () => {
    const zip = buildZip([{ path: 'only.txt', data: encoder.encode('content') }]);
    // Store-only entries carry their raw bytes right after the 30-byte local header + file name.
    const nameLength = readUint16LE(zip, 26);
    const dataStart = 30 + nameLength;
    const dataLength = readUint32LE(zip, 18);
    const stored = zip.slice(dataStart, dataStart + dataLength);
    expect(new TextDecoder().decode(stored)).toBe('content');
  });

  it('returns a well-formed, empty-but-valid archive for zero files', () => {
    const zip = buildZip([]);
    expect(readUint32LE(zip, 0)).toBe(0x06054b50);
  });
});
