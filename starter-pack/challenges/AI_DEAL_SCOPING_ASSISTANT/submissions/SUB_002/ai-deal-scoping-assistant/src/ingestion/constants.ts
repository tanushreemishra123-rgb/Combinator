/** Upload limits and format detection shared by validation and the file readers. */
import type { SourceFormat } from '../domain';

export const SUPPORTED_UPLOAD_EXTENSIONS: readonly string[] = ['.txt', '.md', '.markdown', '.docx', '.pdf'];
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MIN_REQUIREMENTS_CHARACTERS = 80;
export const MAX_REQUIREMENTS_CHARACTERS = 200_000;

/** Maps a supported file extension to the normalised document format it produces. */
export const EXTENSION_FORMATS: ReadonlyMap<string, SourceFormat> = new Map([
  ['.txt', 'text'],
  ['.md', 'markdown'],
  ['.markdown', 'markdown'],
  ['.docx', 'docx'],
  ['.pdf', 'pdf'],
]);
