/** Client-side pre-check for a dropped/selected file, ahead of the async `addUploadedFile` use case. */
import { MAX_UPLOAD_BYTES, SUPPORTED_UPLOAD_EXTENSIONS } from '../../ingestion';

function extensionOf(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex === -1 ? '' : fileName.slice(dotIndex).toLowerCase();
}

function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Returns a plain-language rejection reason, or `null` when the file is worth sending to `addUploadedFile`. */
export function validateUploadCandidate(file: File): string | null {
  const extension = extensionOf(file.name);
  if (!SUPPORTED_UPLOAD_EXTENSIONS.includes(extension)) {
    return `"${file.name}" is not a supported format. Upload ${SUPPORTED_UPLOAD_EXTENSIONS.join(', ')} files.`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `"${file.name}" is ${formatMegabytes(file.size)}, over the ${formatMegabytes(MAX_UPLOAD_BYTES)} upload limit.`;
  }
  if (file.size === 0) {
    return `"${file.name}" is empty.`;
  }
  return null;
}
