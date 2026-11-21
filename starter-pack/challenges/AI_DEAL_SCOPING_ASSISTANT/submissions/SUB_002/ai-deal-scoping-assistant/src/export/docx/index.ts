/**
 * Renders a `PackageDocument` as a valid .docx (WordprocessingML packaged as a ZIP), built with
 * zero dependencies (spec 6: "exportable in at least one readable format"). The mandatory
 * disclaimer statement is written as a shaded callout at the top and again at the end, exactly as
 * in the Markdown and HTML exports.
 */
import type { PackageDocument } from '../../domain';
import { formatTimestamp } from '../text';
import { sectionToXml } from './blocks';
import { CONTENT_TYPES_XML, DOCUMENT_RELS_XML, NUMBERING_XML, ROOT_RELS_XML, STYLES_XML } from './parts';
import { calloutParagraphs, paragraph } from './wordXml';
import { buildZip } from './zip';
import type { ZipFileInput } from './zip';

const DOCUMENT_XML_HEADER =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
  '<w:body>';

const SECTION_PROPERTIES =
  '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>';

const DOCUMENT_XML_FOOTER = [SECTION_PROPERTIES, '</w:body>', '</w:document>'].join('');

function buildDocumentBodyXml(doc: PackageDocument): string {
  const header = [
    paragraph(doc.title, 'Title'),
    paragraph(doc.subtitle),
    paragraph(`Generated: ${formatTimestamp(doc.generatedAt)}  |  AI mode: ${doc.aiModeLabel}  |  Export status: ${doc.exportStatus}`),
    calloutParagraphs('Mandatory statement', doc.disclaimer),
  ].join('');
  const body = doc.sections.map(sectionToXml).join('');
  const footer = calloutParagraphs('Mandatory statement', doc.disclaimer);
  return header + body + footer;
}

/** Assembles the full .docx package: document.xml plus the fixed content-types, relationship,
 * style and numbering parts, written into a store-only ZIP with correct CRC-32 checksums. */
export function toDocx(doc: PackageDocument): Uint8Array {
  const documentXml = [DOCUMENT_XML_HEADER, buildDocumentBodyXml(doc), DOCUMENT_XML_FOOTER].join('');
  const encoder = new TextEncoder();
  const files: ZipFileInput[] = [
    { path: '[Content_Types].xml', data: encoder.encode(CONTENT_TYPES_XML) },
    { path: '_rels/.rels', data: encoder.encode(ROOT_RELS_XML) },
    { path: 'word/_rels/document.xml.rels', data: encoder.encode(DOCUMENT_RELS_XML) },
    { path: 'word/styles.xml', data: encoder.encode(STYLES_XML) },
    { path: 'word/numbering.xml', data: encoder.encode(NUMBERING_XML) },
    { path: 'word/document.xml', data: encoder.encode(documentXml) },
  ];
  return buildZip(files);
}
