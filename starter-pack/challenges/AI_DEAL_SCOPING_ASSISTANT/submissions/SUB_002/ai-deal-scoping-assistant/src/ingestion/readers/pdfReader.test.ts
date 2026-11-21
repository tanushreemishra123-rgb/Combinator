import { getDocument, PasswordException } from 'pdfjs-dist';
import { IngestionError } from '../errors';
import { readPdfFile } from './pdfReader';

vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: 'worker-url' }));
vi.mock('pdfjs-dist', () => {
  class FakePasswordException extends Error {}
  return {
    GlobalWorkerOptions: { workerSrc: '' },
    PasswordException: FakePasswordException,
    getDocument: vi.fn(),
  };
});

const getDocumentMock = vi.mocked(getDocument);

interface FakePage {
  getTextContent: () => Promise<{ items: unknown[] }>;
}

function fakePage(): FakePage {
  return { getTextContent: () => Promise.resolve({ items: [] }) };
}

/** A task whose `.promise` resolves to a one-page document, or rejects with `failure`. */
function taskFor(options: { failure?: unknown; getPage?: () => Promise<FakePage> } = {}): { promise: Promise<unknown>; destroy: ReturnType<typeof vi.fn> } {
  const destroy = vi.fn().mockResolvedValue(undefined);
  const promise =
    options.failure !== undefined
      ? Promise.reject(options.failure)
      : Promise.resolve({ numPages: 1, getPage: options.getPage ?? (() => Promise.resolve(fakePage())) });
  return { promise, destroy };
}

function pdfFile(): File {
  return new File(['pdf bytes'], 'requirements.pdf', { type: 'application/pdf' });
}

beforeEach(() => {
  getDocumentMock.mockReset();
});

describe('readPdfFile', () => {
  it('destroys the loading task after a successful read', async () => {
    const task = taskFor();
    getDocumentMock.mockReturnValue(task as never);

    await readPdfFile(pdfFile());

    expect(task.destroy).toHaveBeenCalledTimes(1);
  });

  it('destroys the loading task even when reading a page fails, and maps the failure to an IngestionError', async () => {
    const task = taskFor({ getPage: () => Promise.reject(new Error('boom')) });
    getDocumentMock.mockReturnValue(task as never);

    await expect(readPdfFile(pdfFile())).rejects.toThrow(IngestionError);
    expect(task.destroy).toHaveBeenCalledTimes(1);
  });

  it('maps a password-protected PDF to the encrypted IngestionError and still destroys the task', async () => {
    const task = taskFor({ failure: new PasswordException('needs a password', 1) });
    getDocumentMock.mockReturnValue(task as never);

    const rejection = expect(readPdfFile(pdfFile())).rejects;
    await rejection.toThrow(IngestionError);
    await rejection.toMatchObject({ kind: 'encrypted' });
    expect(task.destroy).toHaveBeenCalledTimes(1);
  });

  it('maps a failure reading the file itself to a readable error without touching a loading task', async () => {
    const file = pdfFile();
    vi.spyOn(file, 'arrayBuffer').mockRejectedValue(new Error('could not read'));

    await expect(readPdfFile(file)).rejects.toThrow(IngestionError);
    expect(getDocumentMock).not.toHaveBeenCalled();
  });
});
