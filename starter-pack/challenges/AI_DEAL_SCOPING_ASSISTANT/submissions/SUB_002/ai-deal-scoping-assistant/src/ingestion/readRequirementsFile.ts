/** Upload entry point: enforces the extension allow-list and size limit, then dispatches by format. */
import type { SourceFormat, UploadedDocumentInfo } from '../domain';
import { EXTENSION_FORMATS, MAX_UPLOAD_BYTES, SUPPORTED_UPLOAD_EXTENSIONS } from './constants';
import { IngestionError } from './errors';
import { readDocxFile } from './readers/docxReader';
import { readPdfFile } from './readers/pdfReader';
import { readTextFile } from './readers/textReader';

function detectFormat(fileName: string): SourceFormat | null {
  const lower = fileName.toLowerCase();
  for (const [extension, format] of EXTENSION_FORMATS) {
    if (lower.endsWith(extension)) {
      return format;
    }
  }
  return null;
}

function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function readByFormat(file: File, format: SourceFormat): Promise<string> {
  switch (format) {
    case 'text':
    case 'markdown':
      return readTextFile(file);
    case 'docx':
      return readDocxFile(file);
    case 'pdf':
      return readPdfFile(file);
  }
}

/**
 * Reads an uploaded requirements file. Throws a typed `IngestionError` for an unsupported
 * extension, an oversize file, or a file that reads back as empty, unreadable or encrypted.
 */
export async function readRequirementsFile(
  file: File,
  now: string = new Date().toISOString(),
): Promise<{ text: string; info: UploadedDocumentInfo }> {
  const format = detectFormat(file.name);
  if (format === null) {
    throw new IngestionError(
      'unsupported-type',
      `"${file.name}" is not a supported file type. Upload one of: ${SUPPORTED_UPLOAD_EXTENSIONS.join(', ')}.`,
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new IngestionError(
      'oversize',
      `"${file.name}" is ${formatMegabytes(file.size)}, larger than the ${formatMegabytes(MAX_UPLOAD_BYTES)} upload limit. Split the document or paste the text directly.`,
    );
  }
  const text = await readByFormat(file, format);
  if (text.trim().length === 0) {
    throw new IngestionError('empty', `"${file.name}" does not contain any readable text.`);
  }
  return { text, info: { name: file.name, format, characters: text.length, addedAt: now } };
}
