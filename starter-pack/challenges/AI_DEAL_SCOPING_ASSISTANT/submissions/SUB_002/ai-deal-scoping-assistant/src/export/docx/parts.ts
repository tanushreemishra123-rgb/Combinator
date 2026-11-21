/**
 * The fixed OOXML package parts every .docx needs beside `word/document.xml`: content types, the
 * package and document relationships, paragraph styles (including the shaded "Callout" style) and
 * the single bullet-list numbering definition used by every list in the document.
 */
import { element, voidElement } from '../../markup';
import type { Attribute } from '../../markup';

export const CONTENT_TYPES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
  '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
  '</Types>';

export const ROOT_RELS_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  '</Relationships>';

export const DOCUMENT_RELS_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
  '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>' +
  '</Relationships>';

interface StyleSpec {
  id: string;
  name: string;
  basedOn?: string;
  sizeHalfPoints: number;
  bold: boolean;
  shaded?: string;
}

const STYLE_SPECS: readonly StyleSpec[] = [
  { id: 'Title', name: 'Title', sizeHalfPoints: 44, bold: true },
  { id: 'Heading1', name: 'heading 1', sizeHalfPoints: 32, bold: true },
  { id: 'Heading2', name: 'heading 2', sizeHalfPoints: 28, bold: true },
  { id: 'Heading3', name: 'heading 3', sizeHalfPoints: 26, bold: true },
  { id: 'Heading4', name: 'heading 4', sizeHalfPoints: 24, bold: true },
  { id: 'ListParagraph', name: 'List Paragraph', sizeHalfPoints: 22, bold: false },
  { id: 'Callout', name: 'Callout', sizeHalfPoints: 22, bold: false, shaded: 'FFF4CE' },
];

function styleXml(spec: StyleSpec): string {
  const shading = spec.shaded === undefined ? '' : voidElement('w:shd', [['w:val', 'clear'], ['w:fill', spec.shaded]]);
  const spacing = voidElement('w:spacing', [['w:before', 120], ['w:after', 120]]);
  const properties = element('w:pPr', [], spacing, shading);
  const bold = spec.bold ? voidElement('w:b', []) : '';
  const size = voidElement('w:sz', [['w:val', spec.sizeHalfPoints]]);
  const runProperties = element('w:rPr', [], bold, size);
  const attributes: Attribute[] = [
    ['w:type', 'paragraph'],
    ['w:styleId', spec.id],
  ];
  const name = voidElement('w:name', [['w:val', spec.name]]);
  const basedOn = voidElement('w:basedOn', [['w:val', 'Normal']]);
  return element('w:style', attributes, name, basedOn, properties, runProperties);
}

export const STYLES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
  '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
  STYLE_SPECS.map(styleXml).join('') +
  '</w:styles>';

export const NUMBERING_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
  '<w:abstractNum w:abstractNumId="0">' +
  '<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="&#8226;"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl>' +
  '</w:abstractNum>' +
  '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>' +
  '</w:numbering>';
