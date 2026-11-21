/**
 * Hand-rolled, dependency-free "stored" (uncompressed) ZIP archive builder used only by tests, to
 * exercise `zip.ts` and `docxReader.ts` against real ZIP bytes instead of mocking the format away.
 */
import { ZIP_COMPRESSION_STORED } from './zip';

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const EOCD_SIGNATURE = 0x06054b50;
const LOCAL_HEADER_SIZE = 30;
const CENTRAL_HEADER_SIZE = 46;
const EOCD_SIZE = 22;

export interface ZipSourceEntry {
  name: string;
  content: string;
}

interface PreparedEntry {
  nameBytes: Uint8Array;
  contentBytes: Uint8Array;
  localOffset: number;
}

function prepareEntries(entries: readonly ZipSourceEntry[]): PreparedEntry[] {
  const prepared: PreparedEntry[] = [];
  let offset = 0;
  for (const entry of entries) {
    const nameBytes = new TextEncoder().encode(entry.name);
    const contentBytes = new TextEncoder().encode(entry.content);
    prepared.push({ nameBytes, contentBytes, localOffset: offset });
    offset += LOCAL_HEADER_SIZE + nameBytes.length + contentBytes.length;
  }
  return prepared;
}

function buildLocalRecord(entry: PreparedEntry): Uint8Array {
  const record = new Uint8Array(LOCAL_HEADER_SIZE + entry.nameBytes.length + entry.contentBytes.length);
  const view = new DataView(record.buffer);
  view.setUint32(0, LOCAL_FILE_HEADER_SIGNATURE, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, ZIP_COMPRESSION_STORED, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint32(14, 0, true);
  view.setUint32(18, entry.contentBytes.length, true);
  view.setUint32(22, entry.contentBytes.length, true);
  view.setUint16(26, entry.nameBytes.length, true);
  view.setUint16(28, 0, true);
  record.set(entry.nameBytes, LOCAL_HEADER_SIZE);
  record.set(entry.contentBytes, LOCAL_HEADER_SIZE + entry.nameBytes.length);
  return record;
}

function buildCentralRecord(entry: PreparedEntry): Uint8Array {
  const record = new Uint8Array(CENTRAL_HEADER_SIZE + entry.nameBytes.length);
  const view = new DataView(record.buffer);
  view.setUint32(0, CENTRAL_DIRECTORY_SIGNATURE, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, ZIP_COMPRESSION_STORED, true);
  view.setUint16(12, 0, true);
  view.setUint16(14, 0, true);
  view.setUint32(16, 0, true);
  view.setUint32(20, entry.contentBytes.length, true);
  view.setUint32(24, entry.contentBytes.length, true);
  view.setUint16(28, entry.nameBytes.length, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, entry.localOffset, true);
  record.set(entry.nameBytes, CENTRAL_HEADER_SIZE);
  return record;
}

function buildEndOfCentralDirectory(entryCount: number, centralDirectorySize: number, centralDirectoryOffset: number): Uint8Array {
  const record = new Uint8Array(EOCD_SIZE);
  const view = new DataView(record.buffer);
  view.setUint32(0, EOCD_SIGNATURE, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, entryCount, true);
  view.setUint16(10, entryCount, true);
  view.setUint32(12, centralDirectorySize, true);
  view.setUint32(16, centralDirectoryOffset, true);
  view.setUint16(20, 0, true);
  return record;
}

function concatParts(parts: readonly Uint8Array[]): ArrayBuffer {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(totalLength);
  let writeOffset = 0;
  for (const part of parts) {
    result.set(part, writeOffset);
    writeOffset += part.length;
  }
  return result.buffer;
}

/** Builds a minimal, valid "stored" (uncompressed, method 0) ZIP archive in memory. */
export function buildStoredZip(entries: readonly ZipSourceEntry[]): ArrayBuffer {
  const prepared = prepareEntries(entries);
  const localRecords = prepared.map(buildLocalRecord);
  const centralRecords = prepared.map(buildCentralRecord);
  const centralDirectoryOffset = localRecords.reduce((sum, record) => sum + record.length, 0);
  const centralDirectorySize = centralRecords.reduce((sum, record) => sum + record.length, 0);
  const eocd = buildEndOfCentralDirectory(prepared.length, centralDirectorySize, centralDirectoryOffset);
  return concatParts([...localRecords, ...centralRecords, eocd]);
}
