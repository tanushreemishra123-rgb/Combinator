/**
 * PDF reader built on `pdfjs-dist`, loaded lazily so it never lands in the main bundle unless a
 * PDF is actually uploaded. The pdf.js-specific parts are kept to this file and `loadPdfJs`; the
 * page-by-page line reconstruction itself lives in the pure, unit-testable `pdfLineGrouping.ts`.
 */
import type { PDFDocumentLoadingTask } from 'pdfjs-dist';
import { IngestionError } from '../errors';
import { groupTextItemsIntoLines, type PositionedTextItem } from './pdfLineGrouping';

/** Extracts a positioned text item's fields defensively - pdf.js's `TextMarkedContent` items lack them. */
function toPositionedItem(item: unknown): PositionedTextItem | null {
  if (typeof item !== 'object' || item === null || !('str' in item) || !('transform' in item)) {
    return null;
  }
  const str = (item as { str: unknown }).str;
  const transform = (item as { transform: unknown }).transform;
  if (typeof str !== 'string' || !Array.isArray(transform)) {
    return null;
  }
  return { text: str, x: Number(transform.at(4) ?? 0), y: Number(transform.at(5) ?? 0) };
}

async function loadPdfJs() {
  const [pdfjs, workerUrl] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl.default;
  return pdfjs;
}

function toIngestionError(error: unknown, isPasswordError: boolean): IngestionError {
  if (isPasswordError) {
    return new IngestionError('encrypted', 'This PDF is password-protected. Remove the password and re-upload an unprotected file.');
  }
  const message = error instanceof Error ? error.message : 'unknown error';
  return new IngestionError('unreadable', `This PDF could not be read (${message}). It may be corrupted, or a scan without extractable text.`);
}

/**
 * Reads a PDF's extractable text, grouping each page's text items into lines by their y
 * coordinate. `loadPdfJs()` and reading the file both happen inside the try, so a failure there
 * (e.g. the worker chunk fails to load) maps to the same readable `IngestionError` as a parsing
 * failure, instead of an unmapped raw error. The loading task is always destroyed in `finally`,
 * whether or not it ever resolved, so a failed or abandoned upload does not leave its worker running.
 */
export async function readPdfFile(file: File): Promise<string> {
  let pdfjs: Awaited<ReturnType<typeof loadPdfJs>> | undefined;
  let task: PDFDocumentLoadingTask | undefined;
  try {
    pdfjs = await loadPdfJs();
    const buffer = await file.arrayBuffer();
    task = pdfjs.getDocument({ data: buffer });
    const document = await task.promise;
    const pageLines: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const positioned = content.items
        .map((item): PositionedTextItem | null => toPositionedItem(item))
        .filter((item): item is PositionedTextItem => item !== null);
      pageLines.push(...groupTextItemsIntoLines(positioned));
    }
    return pageLines.join('\n');
  } catch (error) {
    throw toIngestionError(error, pdfjs !== undefined && error instanceof pdfjs.PasswordException);
  } finally {
    void task?.destroy();
  }
}
