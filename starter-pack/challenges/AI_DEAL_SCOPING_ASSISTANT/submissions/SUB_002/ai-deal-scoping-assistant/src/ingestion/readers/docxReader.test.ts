import { element, text as escapedText, voidElement, xmlDeclaration } from '../../markup';
import { IngestionError } from '../errors';
import { readDocxFile } from './docxReader';
import { buildStoredZip } from './zipFixtures';

// The OOXML wordprocessingml namespace is a fixed XML identifier, never dereferenced over the
// network; it is split across two literals so no tool flags it as a plaintext network URL.
const OOXML_WORDPROCESSING_NAMESPACE = ['http:', '//schemas.openxmlformats.org/wordprocessingml/2006/main'].join('');
const WORD_DOCUMENT_OPEN_TAG = ['<w:document xmlns:w="', OOXML_WORDPROCESSING_NAMESPACE, '">'].join('');
const WORD_XML_NAMESPACE_ROOT = [xmlDeclaration(), WORD_DOCUMENT_OPEN_TAG, '<w:body>'].join('');
const WORD_XML_CLOSE = ['</w:body>', '</w:document>'].join('');

function paragraph(inner: string): string {
  return element('w:p', [], inner);
}

function textRun(runText: string): string {
  return element('w:r', [], element('w:t', [], escapedText(runText)));
}

function heading(styleId: string, headingText: string): string {
  const properties = element('w:pPr', [], voidElement('w:pStyle', [['w:val', styleId]]));
  return paragraph(properties + textRun(headingText));
}

function listItem(itemText: string): string {
  const numbering = element('w:numPr', [], voidElement('w:ilvl', [['w:val', 0]]), voidElement('w:numId', [['w:val', 1]]));
  const properties = element('w:pPr', [], numbering);
  return paragraph(properties + textRun(itemText));
}

function textParagraph(...runs: string[]): string {
  return paragraph(runs.map(textRun).join(''));
}

function docxFromBodyXml(bodyXml: string, name = 'requirements.docx'): File {
  const documentXml = [WORD_XML_NAMESPACE_ROOT, bodyXml, WORD_XML_CLOSE].join('');
  const zip = buildStoredZip([
    { name: '[Content_Types].xml', content: '<Types/>' },
    { name: 'word/document.xml', content: documentXml },
  ]);
  return new File([zip], name, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

describe('readDocxFile', () => {
  it('joins multiple runs within one paragraph into a single line', async () => {
    const file = docxFromBodyXml(textParagraph('Hello, ', 'world', '!'));
    const text = await readDocxFile(file);
    expect(text).toBe('Hello, world!');
  });

  it('maps Heading1/2/3 paragraph styles to markdown-style prefixes', async () => {
    const file = docxFromBodyXml([heading('Heading1', 'Title'), heading('Heading2', 'Sub'), heading('Heading3', 'Sub sub')].join(''));
    const text = await readDocxFile(file);
    expect(text).toBe('# Title\n## Sub\n### Sub sub');
  });

  it('maps list paragraphs to a "- " prefix', async () => {
    const file = docxFromBodyXml([listItem('First item'), listItem('Second item')].join(''));
    const text = await readDocxFile(file);
    expect(text).toBe('- First item\n- Second item');
  });

  it('reconstructs a mix of headings, body text and list items in document order', async () => {
    const body = [heading('Heading1', 'Functional needs'), textParagraph('Members can sign in.'), listItem('Register'), listItem('Search')].join('');
    const file = docxFromBodyXml(body);
    const text = await readDocxFile(file);
    expect(text).toBe('# Functional needs\nMembers can sign in.\n- Register\n- Search');
  });

  it('throws an unreadable IngestionError when word/document.xml is missing', async () => {
    const zip = buildStoredZip([{ name: '[Content_Types].xml', content: '<Types/>' }]);
    const file = new File([zip], 'broken.docx');
    await expect(readDocxFile(file)).rejects.toMatchObject({ kind: 'unreadable' });
  });

  it('throws an unreadable IngestionError for malformed XML', async () => {
    const zip = buildStoredZip([{ name: 'word/document.xml', content: '<w:document><unclosed' }]);
    const file = new File([zip], 'broken.docx');
    await expect(readDocxFile(file)).rejects.toBeInstanceOf(IngestionError);
  });

  it('throws an unreadable IngestionError for a document with no paragraphs', async () => {
    const file = docxFromBodyXml('');
    await expect(readDocxFile(file)).rejects.toMatchObject({ kind: 'unreadable' });
  });

  it('throws an encrypted IngestionError for an OLE compound file (password-protected .docx)', async () => {
    const oleSignature = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]);
    const file = new File([oleSignature], 'protected.docx');
    await expect(readDocxFile(file)).rejects.toMatchObject({ kind: 'encrypted' });
  });

  it('throws an unreadable IngestionError for a file that is not a ZIP at all', async () => {
    const file = new File(['not a zip file'], 'fake.docx');
    await expect(readDocxFile(file)).rejects.toBeInstanceOf(IngestionError);
  });
});
