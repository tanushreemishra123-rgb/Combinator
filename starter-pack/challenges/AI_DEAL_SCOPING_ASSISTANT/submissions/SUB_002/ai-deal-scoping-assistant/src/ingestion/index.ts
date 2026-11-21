/**
 * Document-ingestion layer: text normalisation into sections/lines, input validation, and file
 * readers for .txt/.md/.markdown/.docx/.pdf uploads.
 */
export { MAX_REQUIREMENTS_CHARACTERS, MAX_UPLOAD_BYTES, MIN_REQUIREMENTS_CHARACTERS, SUPPORTED_UPLOAD_EXTENSIONS } from './constants';
export { IngestionError, type IngestionErrorKind } from './errors';
export { normalizeRequirements } from './normalize';
export { validateRequirementsText } from './validate';
export { countWords } from './wordCount';
export { readRequirementsFile } from './readRequirementsFile';
export { groupTextItemsIntoLines, type PositionedTextItem } from './readers/pdfLineGrouping';
export { listZipEntries, readZipEntryBytes, ZIP_COMPRESSION_DEFLATE, ZIP_COMPRESSION_STORED, type ZipEntry } from './readers/zip';
