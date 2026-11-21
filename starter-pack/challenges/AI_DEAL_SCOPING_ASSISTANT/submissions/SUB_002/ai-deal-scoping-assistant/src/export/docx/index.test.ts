import { EXPORT_DISCLAIMER } from '../../domain';
import type { PackageDocument } from '../../domain';
import { buildPackage } from '../packageBuilder';
import { buildFullyPopulatedSession } from '../packageFixture.data';
import { fixtureSession } from '../../test/fixtures';
import { toDocx } from './index';

/** Reads one stored (uncompressed) entry back out of a ZIP built by `buildZip`, by scanning the
 * sequential local file headers - a minimal reader for the exact archive shape this module writes. */
function readZipEntry(zip: Uint8Array, path: string): Uint8Array | null {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const decoder = new TextDecoder();
  let offset = 0;
  while (offset + 4 <= zip.length && view.getUint32(offset, true) === 0x04034b50) {
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = decoder.decode(zip.slice(nameStart, nameStart + nameLength));
    if (name === path) {
      return zip.slice(dataStart, dataStart + compressedSize);
    }
    offset = dataStart + compressedSize;
  }
  return null;
}

function documentXmlText(doc: PackageDocument): string {
  const zip = toDocx(doc);
  const entry = readZipEntry(zip, 'word/document.xml');
  expect(entry).not.toBeNull();
  return new TextDecoder().decode(entry ?? new Uint8Array(0));
}

describe('toDocx', () => {
  it('packages every required OOXML part', () => {
    const zip = toDocx(buildPackage(fixtureSession(), { aiModeLabel: 'Mock AI mode', generatedAt: '2026-09-19T00:00:00.000Z' }));
    for (const path of ['[Content_Types].xml', '_rels/.rels', 'word/_rels/document.xml.rels', 'word/styles.xml', 'word/numbering.xml', 'word/document.xml']) {
      expect(readZipEntry(zip, path), path).not.toBeNull();
    }
  });

  it('contains the mandatory disclaimer statement in document.xml, found by searching its UTF-8 bytes', () => {
    const doc = buildPackage(fixtureSession(), { aiModeLabel: 'Mock AI mode', generatedAt: '2026-09-19T00:00:00.000Z' });
    expect(documentXmlText(doc)).toContain(EXPORT_DISCLAIMER);
  });

  it('XML-escapes an ampersand in the document title and subtitle', () => {
    const doc = buildPackage(fixtureSession(), { aiModeLabel: 'Mock AI mode', generatedAt: '2026-09-19T00:00:00.000Z' });
    const withAmpersand: PackageDocument = { ...doc, title: 'Acme & Co - Integrated Scoping Package', subtitle: 'Acme & Co' };
    const xml = documentXmlText(withAmpersand);
    expect(xml).toContain('Acme &amp; Co');
    expect(xml).not.toContain('Acme & Co');
  });

  it('never throws for a fully populated session and produces a well-formed ZIP', () => {
    const doc = buildPackage(buildFullyPopulatedSession(), { aiModeLabel: 'Mock AI mode', generatedAt: '2026-09-19T00:00:00.000Z' });
    expect(() => toDocx(doc)).not.toThrow();
    const zip = toDocx(doc);
    expect(readZipEntry(zip, 'word/document.xml')).not.toBeNull();
  });
});
