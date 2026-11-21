/**
 * Browser download helper for exported package files (spec 6: "exportable in at least one readable
 * format"). This is the one file in `src/export` allowed to touch the DOM; every other export
 * module is pure TypeScript.
 */
import type { ExportFormat, ScopingSession } from '../domain';

const TEXT_MIME_TYPES: ReadonlySet<string> = new Set(['text/markdown', 'text/html', 'application/json']);

/** Adds `;charset=utf-8` to text MIME types so a browser never guesses the wrong encoding. */
function mimeTypeWithCharset(mimeType: string): string {
  return TEXT_MIME_TYPES.has(mimeType) ? `${mimeType};charset=utf-8` : mimeType;
}

/** A fresh `Uint8Array` is always backed by a plain `ArrayBuffer`, which is what `Blob` expects -
 * the incoming array's own backing buffer type is not guaranteed to be that specific. */
function toBlobPart(content: string | Uint8Array): BlobPart {
  return typeof content === 'string' ? content : new Uint8Array(content);
}

/** How long a revoke is deferred after `click()`, so a browser that starts the download
 * asynchronously has already read the blob URL before it stops working. */
const REVOKE_DELAY_MS = 1000;

/** Triggers a browser download of `content` as `fileName` via a temporary object-URL anchor, then
 * revokes the URL - after a short delay, not immediately - so the Blob is not kept alive once the
 * download has had time to start. Some Safari and Firefox versions begin the download
 * asynchronously and can fail if the URL is revoked the instant `click()` returns. */
export function downloadFile(fileName: string, content: string | Uint8Array, mimeType: string): void {
  const blob = new Blob([toBlobPart(content)], { type: mimeTypeWithCharset(mimeType) });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
  }
}

const EXTENSION_BY_FORMAT: ReadonlyMap<ExportFormat, string> = new Map([
  ['markdown', 'md'],
  ['html', 'html'],
  ['docx', 'docx'],
  ['json', 'json'],
]);

/** A filesystem-safe slug built from the session name, plus the export format's extension. */
export function fileNameFor(session: ScopingSession, format: ExportFormat): string {
  const base = session.name.trim().length > 0 ? session.name.trim() : 'scoping-package';
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
  const extension = EXTENSION_BY_FORMAT.get(format) ?? 'txt';
  return `${slug.length > 0 ? slug : 'scoping-package'}.${extension}`;
}
