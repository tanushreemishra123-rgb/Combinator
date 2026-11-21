/**
 * Minimal, dependency-free, store-only (compression method 0) ZIP writer - enough to package a
 * .docx, which is just a ZIP of XML parts. Every multi-byte field is written through `DataView`
 * (never `arr[i]`), and the CRC-32 table is read with `.at()` per the project's SAST conventions.
 */

const CRC32_POLYNOMIAL = 0xedb88320;

function buildCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let value = 0; value < 256; value += 1) {
    let crc = value;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) === 1 ? CRC32_POLYNOMIAL ^ (crc >>> 1) : crc >>> 1;
    }
    table.set([crc], value);
  }
  return table;
}

const CRC_TABLE = buildCrcTable();

/** CRC-32 (ISO 3309 / ITU-T V.42), table-driven. `crc32(new TextEncoder().encode('hello'))` is `0x3610a686`. */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    const index = (crc ^ byte) & 0xff;
    crc = (CRC_TABLE.at(index) ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Append-only binary buffer. Every write goes through `DataView`, and bytes are combined with
 * `Uint8Array.set()`, so nothing in this file ever indexes a typed array with a computed key. */
class ByteWriter {
  private readonly chunks: Uint8Array[] = [];
  private total = 0;

  private push(bytes: Uint8Array): this {
    this.chunks.push(bytes);
    this.total += bytes.length;
    return this;
  }

  writeUint16(value: number): this {
    const bytes = new Uint8Array(2);
    new DataView(bytes.buffer).setUint16(0, value, true);
    return this.push(bytes);
  }

  writeUint32(value: number): this {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, value, true);
    return this.push(bytes);
  }

  writeBytes(bytes: Uint8Array): this {
    return this.push(bytes);
  }

  get length(): number {
    return this.total;
  }

  toUint8Array(): Uint8Array {
    const out = new Uint8Array(this.total);
    let offset = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  }
}

export interface ZipFileInput {
  path: string;
  data: Uint8Array;
}

interface PreparedEntry {
  nameBytes: Uint8Array;
  data: Uint8Array;
  crc: number;
  offset: number;
}

const LOCAL_FILE_SIGNATURE = 0x04034b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const VERSION_NEEDED = 20;
const VERSION_MADE_BY = 20;
/** Fixed MS-DOS date/time (1 January 1980): a store-only planning-document archive has no
 * meaningful modification time, and a fixed value keeps the archive byte-for-byte reproducible. */
const DOS_TIME = 0;
const DOS_DATE = 0x21;

function writeLocalEntry(writer: ByteWriter, nameBytes: Uint8Array, data: Uint8Array, crc: number): void {
  writer.writeUint32(LOCAL_FILE_SIGNATURE).writeUint16(VERSION_NEEDED).writeUint16(0).writeUint16(0);
  writer.writeUint16(DOS_TIME).writeUint16(DOS_DATE);
  writer.writeUint32(crc).writeUint32(data.length).writeUint32(data.length);
  writer.writeUint16(nameBytes.length).writeUint16(0);
  writer.writeBytes(nameBytes).writeBytes(data);
}

function writeCentralEntry(writer: ByteWriter, entry: PreparedEntry): void {
  writer.writeUint32(CENTRAL_DIRECTORY_SIGNATURE).writeUint16(VERSION_MADE_BY).writeUint16(VERSION_NEEDED).writeUint16(0).writeUint16(0);
  writer.writeUint16(DOS_TIME).writeUint16(DOS_DATE);
  writer.writeUint32(entry.crc).writeUint32(entry.data.length).writeUint32(entry.data.length);
  writer.writeUint16(entry.nameBytes.length).writeUint16(0).writeUint16(0);
  writer.writeUint16(0).writeUint16(0).writeUint32(0);
  writer.writeUint32(entry.offset);
  writer.writeBytes(entry.nameBytes);
}

/** Builds a minimal, valid, store-only ZIP: local headers and data, then the central directory,
 * then the end-of-central-directory record. A .docx is exactly this shape holding XML parts. */
export function buildZip(files: readonly ZipFileInput[]): Uint8Array {
  const encoder = new TextEncoder();
  const body = new ByteWriter();
  const prepared: PreparedEntry[] = files.map((file) => {
    const nameBytes = encoder.encode(file.path);
    const offset = body.length;
    const crc = crc32(file.data);
    writeLocalEntry(body, nameBytes, file.data, crc);
    return { nameBytes, data: file.data, crc, offset };
  });

  const central = new ByteWriter();
  for (const entry of prepared) {
    writeCentralEntry(central, entry);
  }

  const end = new ByteWriter();
  end.writeUint32(END_OF_CENTRAL_DIRECTORY_SIGNATURE).writeUint16(0).writeUint16(0);
  end.writeUint16(prepared.length).writeUint16(prepared.length);
  end.writeUint32(central.length).writeUint32(body.length).writeUint16(0);

  return new ByteWriter().writeBytes(body.toUint8Array()).writeBytes(central.toUint8Array()).writeBytes(end.toUint8Array()).toUint8Array();
}
