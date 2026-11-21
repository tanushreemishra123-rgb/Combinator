/**
 * Renders a `PackageDocument` as a standalone, print-friendly HTML document (spec 6: "exportable in
 * at least one readable format, such as Markdown, PDF, or DOCX" - this file covers "print to PDF").
 * Every tag is built with the shared `src/markup` builder, which escapes every attribute value and
 * every `text()` text node by construction; when the caller supplies the `DiagramModel`s behind the
 * package's diagram blocks (`buildPackageDiagrams`), a diagram renders as the same SVG the app draws
 * instead of a plain block of Mermaid source.
 */
import { diagramToSvg } from '../diagram';
import type { DiagramModel, DocBlock, PackageDocument, PackageSection } from '../domain';
import { element, htmlDoctype, text, voidElement } from '../markup';
import type { Attribute } from '../markup';
import type { PackageDiagramId } from './packageBuilder';
import { formatTimestamp, slugify } from './text';
import type { CalloutTone } from './text';

const LINE_BREAK = voidElement('br', []);

/** Escaped text with internal newlines turned into `<br />` line breaks. */
function textWithBreaks(value: string): string {
  return value.split('\n').map(text).join(LINE_BREAK);
}

function renderTable(columns: readonly string[], rows: readonly (readonly string[])[]): string {
  const head = element('tr', [], ...columns.map((column) => element('th', [], text(column))));
  const body = rows.map((row) => element('tr', [], ...row.map((cell) => element('td', [], textWithBreaks(cell))))).join('');
  return element('table', [], element('thead', [], head), element('tbody', [], body));
}

const CALLOUT_CLASS: ReadonlyMap<CalloutTone, string> = new Map([
  ['info', 'callout callout-info'],
  ['warning', 'callout callout-warning'],
  ['danger', 'callout callout-danger'],
  ['success', 'callout callout-success'],
]);

function renderCallout(tone: CalloutTone, title: string, body: string): string {
  const className = CALLOUT_CLASS.get(tone) ?? 'callout callout-info';
  const titleEl = element('p', [['class', 'callout-title']], text(title));
  const bodyEl = element('p', [], textWithBreaks(body));
  return element('div', [['class', className]], titleEl, bodyEl);
}

function renderKeyValues(pairs: readonly { key: string; value: string }[]): string {
  const rows = pairs.map((pair) => element('dt', [], text(pair.key)) + element('dd', [], textWithBreaks(pair.value))).join('');
  return element('dl', [['class', 'key-values']], rows);
}

function renderDiagramBlock(block: Extract<DocBlock, { type: 'diagram' }>, diagrams: ReadonlyMap<PackageDiagramId, DiagramModel> | undefined): string {
  const model = diagrams?.get(block.diagramId);
  const title = element('p', [['class', 'diagram-title']], text(block.title));
  if (model === undefined) {
    const source = element('pre', [['class', 'diagram-source']], text(block.mermaid));
    return element('div', [['class', 'diagram']], title, source);
  }
  return element('div', [['class', 'diagram']], title, diagramToSvg(model));
}

function renderBlock(block: DocBlock, diagrams: ReadonlyMap<PackageDiagramId, DiagramModel> | undefined): string {
  switch (block.type) {
    case 'paragraph':
      return element('p', [], textWithBreaks(block.text));
    case 'heading':
      return element(`h${block.level}`, [], text(block.text));
    case 'list':
      return element('ul', [], ...block.items.map((item) => element('li', [], textWithBreaks(item))));
    case 'table':
      return renderTable(block.columns, block.rows);
    case 'callout':
      return renderCallout(block.tone, block.title, block.text);
    case 'keyValues':
      return renderKeyValues(block.pairs);
    case 'diagram':
      return renderDiagramBlock(block, diagrams);
  }
}

function renderSection(section: PackageSection, diagrams: ReadonlyMap<PackageDiagramId, DiagramModel> | undefined): string {
  const blocks = section.blocks.map((block) => renderBlock(block, diagrams)).join('\n');
  const heading = element('h2', [], text(section.title));
  return element('section', [['class', 'package-section'], ['id', slugify(section.title)]], heading, blocks);
}

function renderTableOfContents(sections: readonly PackageSection[]): string {
  const items = sections
    .map((section) => element('li', [], element('a', [['href', `#${slugify(section.title)}`]], text(section.title))))
    .join('');
  const heading = element('h2', [], text('Table of contents'));
  return element('nav', [['class', 'toc']], heading, element('ol', [], items));
}

function renderDisclaimer(disclaimer: string): string {
  return element('blockquote', [['class', 'disclaimer']], text(disclaimer));
}

/** Built with '+' concatenation of plain string literals, never a template literal, so the braces
 * every CSS rule needs are never read as a template-literal interpolation hazard. */
const PAGE_STYLE =
  ':root{color-scheme:light;background:#ffffff;}' +
  'body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;background:#ffffff;margin:0 auto;max-width:960px;padding:24px;line-height:1.5;}' +
  'h1,h2,h3,h4{color:#0f172a;}' +
  'h2{border-bottom:1px solid #cbd5e1;padding-bottom:4px;margin-top:32px;}' +
  '.package-section{page-break-inside:avoid;}' +
  'table{border-collapse:collapse;width:100%;margin:12px 0;}' +
  'th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left;vertical-align:top;font-size:0.92em;}' +
  'th{background:#f1f5f9;}' +
  '.disclaimer{border-left:4px solid #64748b;background:#f8fafc;padding:10px 14px;font-style:italic;}' +
  '.callout{border-radius:6px;padding:10px 14px;margin:12px 0;}' +
  '.callout-title{font-weight:700;margin:0 0 4px;}' +
  '.callout-info{background:#eff6ff;border:1px solid #bfdbfe;}' +
  '.callout-warning{background:#fffbeb;border:1px solid #fde68a;}' +
  '.callout-danger{background:#fef2f2;border:1px solid #fecaca;}' +
  '.callout-success{background:#f0fdf4;border:1px solid #bbf7d0;}' +
  '.key-values{display:grid;grid-template-columns:max-content 1fr;column-gap:12px;row-gap:2px;}' +
  '.key-values dt{font-weight:600;}' +
  '.key-values dd{margin:0;}' +
  '.diagram-source{white-space:pre-wrap;background:#f8fafc;border:1px solid #cbd5e1;padding:10px;}' +
  '.toc{background:#f8fafc;border:1px solid #e2e8f0;padding:12px 20px;}' +
  '@media print{body{max-width:none;padding:0;}.package-section{page-break-after:auto;}h2{page-break-before:always;}a{color:inherit;text-decoration:none;}}';

function renderMetaLine(doc: PackageDocument): string {
  return ['Generated: ', text(formatTimestamp(doc.generatedAt)), ' &middot; AI mode: ', text(doc.aiModeLabel), ' &middot; Export status: ', text(doc.exportStatus)].join('');
}

function renderDocumentHead(title: string): string {
  const metaCharset = voidElement('meta', [['charset', 'utf-8']]);
  const titleEl = element('title', [], text(title));
  const styleEl = element('style', [], PAGE_STYLE);
  return element('head', [], metaCharset, titleEl, styleEl);
}

/**
 * Assembles the full standalone HTML document. The disclaimer appears in a blockquote at the top
 * and again at the end, matching the Markdown and DOCX exports.
 */
export function toHtml(doc: PackageDocument, diagrams?: ReadonlyMap<PackageDiagramId, DiagramModel>): string {
  const bodyParts = [
    element('h1', [], text(doc.title)),
    element('p', [['class', 'subtitle']], text(doc.subtitle)),
    element('p', [['class', 'meta']], renderMetaLine(doc)),
    renderDisclaimer(doc.disclaimer),
    renderTableOfContents(doc.sections),
    ...doc.sections.map((section) => renderSection(section, diagrams)),
    renderDisclaimer(doc.disclaimer),
  ].join('\n');

  const attributes: Attribute[] = [['lang', 'en']];
  const html = element('html', attributes, renderDocumentHead(doc.title), element('body', [], bodyParts));
  return htmlDoctype() + html;
}
