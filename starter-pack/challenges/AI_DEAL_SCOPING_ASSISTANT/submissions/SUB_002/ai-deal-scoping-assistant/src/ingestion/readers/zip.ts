/**
 * Zero-dependency reader for the subset of the ZIP format a .docx package needs: the
 * end-of-central-directory record, the central directory, and stored (0) or deflated (8) entries.
 */
import { IngestionError } from '../errors';

export interface ZipEntry {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const EOCD_FIXED_SIZE = 22;
const CENTRAL_DIRECTORY_FIXED_SIZE = 46;
const LOCAL_HEADER_FIXED_SIZE = 30;
const MAX_ZIP_COMMENT_BYTES = 65_535;
export const ZIP_COMPRESSION_STORED = 0;
export const ZIP_COMPRESSION_DEFLATE = 8;

function malformedZipError(detail: string): IngestionError {
  return new IngestionError('unreadable', `This .docx file is not a valid Word package (${detail}).`);
}

function findEndOfCentralDirectory(view: DataView): number {
  const earliest = Math.max(0, view.byteLength - EOCD_FIXED_SIZE - MAX_ZIP_COMMENT_BYTES);
  for (let offset = view.byteLength - EOCD_FIXED_SIZE; offset >= earliest; offset -= 1) {
    if (offset >= 0 && view.getUint32(offset, true) === EOCD_SIGNATURE) {
      return offset;
    }
  }
  throw malformedZipError('no ZIP end-of-central-directory record found');
}

/** Lists every entry in the ZIP's central directory (name, compression method, sizes, data offset). */
export function listZipEntries(buffer: ArrayBuffer): ZipEntry[] {
  const view = new DataView(buffer);
  const eocdOffset = findEndOfCentralDirectory(view);
  const entryCount = view.getUint16(eocdOffset + 10, true);
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);

  const entries: ZipEntry[] = [];
  let cursor = centralDirectoryOffset;
  for (let i = 0; i < entryCount; i += 1) {
    if (view.getUint32(cursor, true) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw malformedZipError('malformed central directory entry');
    }
    const compressionMethod = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localHeaderOffset = view.getUint32(cursor + 42, true);
    const nameBytes = new Uint8Array(buffer, cursor + CENTRAL_DIRECTORY_FIXED_SIZE, nameLength);
    const name = new TextDecoder('utf-8').decode(nameBytes);
    entries.push({ name, compressionMethod, compressedSize, uncompressedSize, localHeaderOffset });
    cursor += CENTRAL_DIRECTORY_FIXED_SIZE + nameLength + extraLength + commentLength;
  }
  return entries;
}

function concatUint8Arrays(chunks: readonly Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

/** Hard ceiling on one entry's inflated size, regardless of what it declares: a real .docx part
 * never approaches this, but a corrupt or hostile deflate stream could otherwise expand a small
 * upload into gigabytes and crash the tab. */
const MAX_INFLATED_BYTES = 50_000_000;

/** Reads the decompression stream, enforcing `maxBytes` and cancelling as soon as it is exceeded. */
async function readInflatedChunks(reader: ReadableStreamDefaultReader<Uint8Array>, maxBytes: number): Promise<Uint8Array[]> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  let chunkResult = await reader.read();
  while (!chunkResult.done) {
    if (chunkResult.value !== undefined) {
      total += chunkResult.value.length;
      if (total > maxBytes) {
        await reader.cancel();
        throw malformedZipError('entry too large once decompressed');
      }
      chunks.push(chunkResult.value);
    }
    chunkResult = await reader.read();
  }
  return chunks;
}

/**
 * Inflates raw-deflate bytes via the platform `DecompressionStream` (write and read run
 * concurrently), capped at `maxBytes`. A corrupt or truncated stream makes `reader.read()` reject
 * with a bare `TypeError`; that is caught here and rethrown as the same readable `IngestionError`
 * every other malformed-ZIP case uses. `writePromise`'s own rejection (writing to an already-errored
 * stream also rejects) is given an immediate no-op handler so it is never reported as an unhandled
 * rejection - the read side above is what actually surfaces the failure.
 */
async function inflateRawDeflate(bytes: Uint8Array<ArrayBuffer>, maxBytes: number): Promise<Uint8Array> {
  const decompressionStream = new DecompressionStream('deflate-raw');
  const writer = decompressionStream.writable.getWriter();
  const writePromise = writer.write(bytes).then(() => writer.close());
  writePromise.catch(() => undefined);
  const reader = decompressionStream.readable.getReader();
  try {
    const chunks = await readInflatedChunks(reader, maxBytes);
    await writePromise;
    return concatUint8Arrays(chunks);
  } catch (error) {
    if (error instanceof IngestionError) {
      throw error;
    }
    throw malformedZipError('corrupt compressed data');
  }
}

/** Reads and, if needed, decompresses one entry's bytes. */
export async function readZipEntryBytes(buffer: ArrayBuffer, entry: ZipEntry): Promise<Uint8Array> {
  const view = new DataView(buffer);
  if (view.getUint32(entry.localHeaderOffset, true) !== LOCAL_FILE_HEADER_SIGNATURE) {
    throw malformedZipError('malformed local file header');
  }
  const nameLength = view.getUint16(entry.localHeaderOffset + 26, true);
  const extraLength = view.getUint16(entry.localHeaderOffset + 28, true);
  const dataOffset = entry.localHeaderOffset + LOCAL_HEADER_FIXED_SIZE + nameLength + extraLength;
  const compressedBytes = new Uint8Array(buffer, dataOffset, entry.compressedSize);

  switch (entry.compressionMethod) {
    case ZIP_COMPRESSION_STORED:
      return compressedBytes.slice();
    case ZIP_COMPRESSION_DEFLATE:
      return inflateRawDeflate(compressedBytes, Math.min(entry.uncompressedSize, MAX_INFLATED_BYTES));
    default:
      throw malformedZipError(`unsupported ZIP compression method ${entry.compressionMethod}`);
  }
}
