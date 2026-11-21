import { IngestionError } from '../errors';
import { listZipEntries, readZipEntryBytes, ZIP_COMPRESSION_DEFLATE, type ZipEntry } from './zip';
import { buildStoredZip } from './zipFixtures';

function firstEntry(entries: readonly ZipEntry[]): ZipEntry {
  const entry = entries.at(0);
  if (entry === undefined) {
    throw new Error('Test fixture produced no ZIP entries.');
  }
  return entry;
}

async function deflateRaw(text: string): Promise<Uint8Array> {
  const source = new TextEncoder().encode(text);
  const compressionStream = new CompressionStream('deflate-raw');
  const writer = compressionStream.writable.getWriter();
  const writePromise = writer.write(source).then(() => writer.close());
  const reader = compressionStream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let chunkResult = await reader.read();
  while (!chunkResult.done) {
    if (chunkResult.value !== undefined) {
      chunks.push(chunkResult.value);
    }
    chunkResult = await reader.read();
  }
  await writePromise;
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

describe('listZipEntries', () => {
  it('lists every entry with its name, method and sizes', () => {
    const zip = buildStoredZip([
      { name: 'word/document.xml', content: '<w:document/>' },
      { name: '[Content_Types].xml', content: '<Types/>' },
    ]);
    const entries = listZipEntries(zip);
    expect(entries.map((entry) => entry.name)).toEqual(['word/document.xml', '[Content_Types].xml']);
    expect(entries.at(0)?.compressionMethod).toBe(0);
    expect(entries.at(0)?.uncompressedSize).toBe('<w:document/>'.length);
  });

  it('throws a typed IngestionError for a buffer with no end-of-central-directory record', () => {
    const garbage = new Uint8Array([1, 2, 3, 4, 5]).buffer;
    expect(() => listZipEntries(garbage)).toThrow(IngestionError);
  });

  it('throws a typed IngestionError for an empty buffer', () => {
    expect(() => listZipEntries(new ArrayBuffer(0))).toThrow(IngestionError);
  });
});

describe('readZipEntryBytes', () => {
  it('reads back the exact original bytes for a stored (method 0) entry', async () => {
    const content = 'Hello, ZIP world! Special chars: café, naïve, 中文.';
    const zip = buildStoredZip([{ name: 'word/document.xml', content }]);
    const entry = firstEntry(listZipEntries(zip));
    const bytes = await readZipEntryBytes(zip, entry);
    expect(new TextDecoder('utf-8').decode(bytes)).toBe(content);
  });

  it('inflates a deflate-raw (method 8) entry back to the original bytes', async () => {
    const content = 'Deflate-compressed paragraph text for the Word document body.'.repeat(5);
    const compressed = await deflateRaw(content);
    const zip = buildDeflatedZip('word/document.xml', compressed, content.length);
    const entry = firstEntry(listZipEntries(zip));
    expect(entry.compressionMethod).toBe(ZIP_COMPRESSION_DEFLATE);
    const bytes = await readZipEntryBytes(zip, entry);
    expect(new TextDecoder('utf-8').decode(bytes)).toBe(content);
  });

  it('rejects a corrupt deflate stream with a readable IngestionError instead of a bare TypeError', async () => {
    const garbage = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const zip = buildDeflatedZip('word/document.xml', garbage, 100);
    const entry = firstEntry(listZipEntries(zip));

    const rejection = expect(readZipEntryBytes(zip, entry)).rejects;
    await rejection.toThrow(IngestionError);
    await rejection.toThrow(/not a valid Word package/);
  });

  it('caps the inflated size at the entry\'s declared uncompressed size, refusing to expand beyond it', async () => {
    const content = 'x'.repeat(1000);
    const compressed = await deflateRaw(content);
    // Declares far less than the payload actually inflates to - the same shape as a zip bomb.
    const zip = buildDeflatedZip('word/document.xml', compressed, 10);
    const entry = firstEntry(listZipEntries(zip));

    await expect(readZipEntryBytes(zip, entry)).rejects.toThrow(/too large/);
  });
});

/** Builds a single-entry ZIP with a pre-compressed (method 8) payload, for the inflate test above. */
function buildDeflatedZip(name: string, compressedBytes: Uint8Array, uncompressedSize: number): ArrayBuffer {
  const nameBytes = new TextEncoder().encode(name);
  const localHeaderSize = 30;
  const local = new Uint8Array(localHeaderSize + nameBytes.length + compressedBytes.length);
  const localView = new DataView(local.buffer);
  localView.setUint32(0, 0x04034b50, true);
  localView.setUint16(4, 20, true);
  localView.setUint16(6, 0, true);
  localView.setUint16(8, ZIP_COMPRESSION_DEFLATE, true);
  localView.setUint16(10, 0, true);
  localView.setUint16(12, 0, true);
  localView.setUint32(14, 0, true);
  localView.setUint32(18, compressedBytes.length, true);
  localView.setUint32(22, uncompressedSize, true);
  localView.setUint16(26, nameBytes.length, true);
  localView.setUint16(28, 0, true);
  local.set(nameBytes, localHeaderSize);
  local.set(compressedBytes, localHeaderSize + nameBytes.length);

  const centralHeaderSize = 46;
  const central = new Uint8Array(centralHeaderSize + nameBytes.length);
  const centralView = new DataView(central.buffer);
  centralView.setUint32(0, 0x02014b50, true);
  centralView.setUint16(4, 20, true);
  centralView.setUint16(6, 20, true);
  centralView.setUint16(8, 0, true);
  centralView.setUint16(10, ZIP_COMPRESSION_DEFLATE, true);
  centralView.setUint16(12, 0, true);
  centralView.setUint16(14, 0, true);
  centralView.setUint32(16, 0, true);
  centralView.setUint32(20, compressedBytes.length, true);
  centralView.setUint32(24, uncompressedSize, true);
  centralView.setUint16(28, nameBytes.length, true);
  centralView.setUint16(30, 0, true);
  centralView.setUint16(32, 0, true);
  centralView.setUint16(34, 0, true);
  centralView.setUint16(36, 0, true);
  centralView.setUint32(38, 0, true);
  centralView.setUint32(42, 0, true);
  central.set(nameBytes, centralHeaderSize);

  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(8, 1, true);
  eocdView.setUint16(10, 1, true);
  eocdView.setUint32(12, central.length, true);
  eocdView.setUint32(16, local.length, true);

  const result = new Uint8Array(local.length + central.length + eocd.length);
  result.set(local, 0);
  result.set(central, local.length);
  result.set(eocd, local.length + central.length);
  return result.buffer;
}
