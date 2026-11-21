import { MAX_UPLOAD_BYTES } from './constants';
import { IngestionError } from './errors';
import { readDocxFile } from './readers/docxReader';
import { readPdfFile } from './readers/pdfReader';
import { readRequirementsFile } from './readRequirementsFile';

vi.mock('./readers/docxReader', () => ({ readDocxFile: vi.fn() }));
vi.mock('./readers/pdfReader', () => ({ readPdfFile: vi.fn() }));

describe('readRequirementsFile', () => {
  beforeEach(() => {
    vi.mocked(readDocxFile).mockReset();
    vi.mocked(readPdfFile).mockReset();
  });

  it('reads a .txt file as plain text', async () => {
    const file = new File(['Members must be able to sign in.'], 'requirements.txt', { type: 'text/plain' });
    const result = await readRequirementsFile(file, '2026-09-19T00:00:00.000Z');
    expect(result.text).toBe('Members must be able to sign in.');
    expect(result.info).toEqual({
      name: 'requirements.txt',
      format: 'text',
      characters: 'Members must be able to sign in.'.length,
      addedAt: '2026-09-19T00:00:00.000Z',
    });
  });

  it('reads .md and .markdown files as the markdown format', async () => {
    const mdFile = new File(['# Title\nBody'], 'notes.md');
    const markdownFile = new File(['# Title\nBody'], 'notes.markdown');
    expect((await readRequirementsFile(mdFile)).info.format).toBe('markdown');
    expect((await readRequirementsFile(markdownFile)).info.format).toBe('markdown');
  });

  it('dispatches .docx files to the docx reader', async () => {
    vi.mocked(readDocxFile).mockResolvedValue('# Requirements\nContent from Word.');
    const file = new File(['zip bytes'], 'requirements.docx');
    const result = await readRequirementsFile(file);
    expect(readDocxFile).toHaveBeenCalledWith(file);
    expect(result.text).toBe('# Requirements\nContent from Word.');
    expect(result.info.format).toBe('docx');
  });

  it('dispatches .pdf files to the pdf reader', async () => {
    vi.mocked(readPdfFile).mockResolvedValue('Requirements extracted from PDF.');
    const file = new File(['pdf bytes'], 'requirements.pdf');
    const result = await readRequirementsFile(file);
    expect(readPdfFile).toHaveBeenCalledWith(file);
    expect(result.info.format).toBe('pdf');
  });

  it('rejects an unsupported file extension with a typed error', async () => {
    const file = new File(['content'], 'requirements.exe');
    await expect(readRequirementsFile(file)).rejects.toMatchObject({ kind: 'unsupported-type' });
  });

  it('is case-insensitive when matching the file extension', async () => {
    const file = new File(['Some readable text content here.'], 'REQUIREMENTS.TXT');
    const result = await readRequirementsFile(file);
    expect(result.info.format).toBe('text');
  });

  it('rejects a file larger than the upload limit', async () => {
    const oversized = new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], 'big.txt');
    await expect(readRequirementsFile(oversized)).rejects.toMatchObject({ kind: 'oversize' });
  });

  it('rejects a file that reads back as empty text', async () => {
    vi.mocked(readDocxFile).mockResolvedValue('   \n   ');
    const file = new File(['zip bytes'], 'empty.docx');
    await expect(readRequirementsFile(file)).rejects.toMatchObject({ kind: 'empty' });
  });

  it('propagates a typed IngestionError thrown by a reader', async () => {
    vi.mocked(readDocxFile).mockRejectedValue(new IngestionError('encrypted', 'Password protected.'));
    const file = new File(['zip bytes'], 'protected.docx');
    await expect(readRequirementsFile(file)).rejects.toMatchObject({ kind: 'encrypted' });
  });
});
