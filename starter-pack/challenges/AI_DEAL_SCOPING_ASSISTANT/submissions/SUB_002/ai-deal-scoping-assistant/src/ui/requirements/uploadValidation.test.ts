/** Unit tests for the client-side pre-check ahead of the async `addUploadedFile` use case. */
import { MAX_UPLOAD_BYTES } from '../../ingestion';
import { validateUploadCandidate } from './uploadValidation';

function fileOfSize(name: string, size: number, type = 'text/plain'): File {
  const file = new File([new Uint8Array(Math.max(size, 1))], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('validateUploadCandidate', () => {
  it('accepts a supported, non-empty file within the size limit', () => {
    const file = new File(['Some discovery notes.'], 'notes.txt', { type: 'text/plain' });
    expect(validateUploadCandidate(file)).toBeNull();
  });

  it('rejects an unsupported extension', () => {
    const file = new File(['binary'], 'diagram.exe', { type: 'application/octet-stream' });
    expect(validateUploadCandidate(file)).toContain('not a supported format');
  });

  it('rejects a file over the upload size limit', () => {
    const file = fileOfSize('big-rfp.pdf', MAX_UPLOAD_BYTES + 1, 'application/pdf');
    expect(validateUploadCandidate(file)).toContain('over the');
  });

  it('rejects an empty file', () => {
    const file = fileOfSize('empty.txt', 0);
    expect(validateUploadCandidate(file)).toContain('empty');
  });

  it('treats the extension check case-insensitively', () => {
    const file = new File(['Some notes.'], 'NOTES.TXT', { type: 'text/plain' });
    expect(validateUploadCandidate(file)).toBeNull();
  });
});
