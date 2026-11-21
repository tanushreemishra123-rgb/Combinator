/**
 * Zero-dependency .docx reader: unzips `word/document.xml` (see `zip.ts`) and turns its paragraphs
 * into plain lines, preserving heading and list structure so `normalizeRequirements` can detect it.
 */
import { IngestionError } from '../errors';
import { listZipEntries, readZipEntryBytes } from './zip';

const DOCUMENT_XML_PATH = 'word/document.xml';
const PARAGRAPH_TAG = 'w:p';
const STYLE_TAG = 'w:pStyle';
const NUMBERING_TAG = 'w:numPr';
const TEXT_RUN_TAG = 'w:t';

/** OLE Compound File signature: real password-protected .docx files are stored this way, not as ZIP. */
const OLE_COMPOUND_FILE_SIGNATURE: readonly number[] = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

const HEADING_STYLE_PREFIXES: ReadonlyMap<string, string> = new Map([
  ['Heading1', '# '],
  ['Heading2', '## '],
  ['Heading3', '### '],
]);

function isOleCompoundFile(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < OLE_COMPOUND_FILE_SIGNATURE.length) {
    return false;
  }
  const bytes = new Uint8Array(buffer, 0, OLE_COMPOUND_FILE_SIGNATURE.length);
  return OLE_COMPOUND_FILE_SIGNATURE.every((expected, index) => bytes.at(index) === expected);
}

function paragraphPrefix(paragraph: Element): string {
  const styleElements = paragraph.getElementsByTagName(STYLE_TAG);
  const styleId = styleElements.length > 0 ? styleElements.item(0)?.getAttribute('w:val') : null;
  const headingPrefix = styleId === null || styleId === undefined ? undefined : HEADING_STYLE_PREFIXES.get(styleId);
  if (headingPrefix !== undefined) {
    return headingPrefix;
  }
  return paragraph.getElementsByTagName(NUMBERING_TAG).length > 0 ? '- ' : '';
}

function paragraphText(paragraph: Element): string {
  const runs = Array.from(paragraph.getElementsByTagName(TEXT_RUN_TAG));
  return runs.map((run) => run.textContent ?? '').join('');
}

/** Converts Word's `document.xml` body into one plain-text line per paragraph. */
function documentXmlToLines(xml: string): string[] {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.getElementsByTagName('parsererror').length > 0) {
    throw new IngestionError('unreadable', 'This .docx file could not be parsed. It may be corrupted or saved in an unsupported format.');
  }
  const paragraphs = Array.from(document.getElementsByTagName(PARAGRAPH_TAG));
  if (paragraphs.length === 0) {
    throw new IngestionError('unreadable', 'This .docx file does not contain any readable paragraphs.');
  }
  return paragraphs.map((paragraph) => `${paragraphPrefix(paragraph)}${paragraphText(paragraph)}`.trimEnd());
}

/** Reads a .docx file's visible text, mapping heading styles to `#`/`##`/`###` and list items to `- `. */
export async function readDocxFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  if (isOleCompoundFile(buffer)) {
    throw new IngestionError('encrypted', 'This .docx file is password-protected. Remove the password and re-upload an unprotected file.');
  }
  const entries = listZipEntries(buffer);
  const documentEntry = entries.find((entry) => entry.name === DOCUMENT_XML_PATH);
  if (documentEntry === undefined) {
    throw new IngestionError('unreadable', 'This .docx file does not contain a readable document body (word/document.xml is missing).');
  }
  const xmlBytes = await readZipEntryBytes(buffer, documentEntry);
  const xml = new TextDecoder('utf-8').decode(xmlBytes);
  return documentXmlToLines(xml).join('\n');
}
