import { fixtureSession } from '../test/fixtures';
import { downloadFile, fileNameFor } from './download';

describe('fileNameFor', () => {
  it('slugifies the session name and appends the format extension', () => {
    const session = { ...fixtureSession(), name: 'Member Portal Modernisation!!' };
    expect(fileNameFor(session, 'markdown')).toBe('member-portal-modernisation.md');
    expect(fileNameFor(session, 'html')).toBe('member-portal-modernisation.html');
    expect(fileNameFor(session, 'docx')).toBe('member-portal-modernisation.docx');
    expect(fileNameFor(session, 'json')).toBe('member-portal-modernisation.json');
  });

  it('falls back to a generic name when the session name is blank', () => {
    expect(fileNameFor({ ...fixtureSession(), name: '   ' }, 'markdown')).toBe('scoping-package.md');
  });
});

describe('downloadFile', () => {
  it('creates an object URL, cleans up the temporary anchor immediately, and revokes the URL shortly after', () => {
    vi.useFakeTimers();
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const bodyChildrenBefore = document.body.children.length;

    downloadFile('package.md', '# Title', 'text/markdown');

    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(document.body.children.length).toBe(bodyChildrenBefore);
    // Not revoked synchronously: a browser that starts the download asynchronously must still be
    // able to read the blob URL after `click()` returns.
    expect(revokeSpy).not.toHaveBeenCalled();

    vi.runAllTimers();
    expect(revokeSpy).toHaveBeenCalledWith('blob:mock-url');

    createSpy.mockRestore();
    revokeSpy.mockRestore();
    vi.useRealTimers();
  });

  it('accepts binary content the same way', () => {
    vi.useFakeTimers();
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-binary');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    expect(() => downloadFile('package.docx', new Uint8Array([1, 2, 3]), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).not.toThrow();
    vi.runAllTimers();

    createSpy.mockRestore();
    revokeSpy.mockRestore();
    vi.useRealTimers();
  });
});
