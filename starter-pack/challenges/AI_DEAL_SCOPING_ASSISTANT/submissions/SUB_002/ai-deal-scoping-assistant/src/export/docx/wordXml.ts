/**
 * Small WordprocessingML fragment builders (paragraphs, headings, bullet lists, bordered tables,
 * shaded callouts) shared by `blocks.ts`. Every piece of text passes through the shared `src/markup`
 * builder's `text()` escaping, and every tag through its `element()` / `voidElement()`, before it
 * reaches the markup.
 */
import { element, text as escapedText, voidElement } from '../../markup';
import type { Attribute } from '../../markup';

function run(runText: string, bold: boolean): string {
  const properties = bold ? element('w:rPr', [], voidElement('w:b', [])) : '';
  const textEl = element('w:t', [['xml:space', 'preserve']], escapedText(runText));
  return element('w:r', [], properties, textEl);
}

/** A plain (or styled, or bold) paragraph holding a single run of text. */
export function paragraph(paragraphText: string, styleId?: string, bold = false): string {
  const properties = styleId === undefined ? '' : element('w:pPr', [], voidElement('w:pStyle', [['w:val', styleId]]));
  return element('w:p', [], properties, run(paragraphText, bold));
}

export function headingParagraph(level: 1 | 2 | 3 | 4, headingText: string): string {
  return paragraph(headingText, `Heading${level}`);
}

/** A bulleted list item using the single bullet list definition in numbering.xml (numId 1). */
export function bulletParagraph(itemText: string): string {
  const numPr = element('w:numPr', [], voidElement('w:ilvl', [['w:val', 0]]), voidElement('w:numId', [['w:val', 1]]));
  const properties = element('w:pPr', [], voidElement('w:pStyle', [['w:val', 'ListParagraph']]), numPr);
  return element('w:p', [], properties, run(itemText, false));
}

export function bulletList(items: readonly string[]): string {
  return items.map(bulletParagraph).join('');
}

/** Two shaded ("Callout" style) paragraphs: a bold title line and the callout text below it. */
export function calloutParagraphs(title: string, calloutText: string): string {
  return paragraph(title, 'Callout', true) + paragraph(calloutText, 'Callout');
}

const TABLE_BORDER_SIDES = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'] as const;

function tableBorders(): string {
  const sides = TABLE_BORDER_SIDES.map((side) => {
    const attributes: Attribute[] = [
      ['w:val', 'single'],
      ['w:sz', 4],
      ['w:space', 0],
      ['w:color', '999999'],
    ];
    return voidElement(`w:${side}`, attributes);
  }).join('');
  return element('w:tblBorders', [], sides);
}

function tableCell(cellText: string, bold: boolean): string {
  const properties = element('w:tcPr', [], voidElement('w:tcW', [['w:w', 0], ['w:type', 'auto']]));
  return element('w:tc', [], properties, paragraph(cellText, undefined, bold));
}

function tableRow(cells: readonly string[], bold: boolean): string {
  return element('w:tr', [], ...cells.map((cell) => tableCell(cell, bold)));
}

/** A bordered table: a bold header row followed by one row per data row, or a plain paragraph when
 * there are no rows to show (an empty, header-only table would read like a rendering bug). */
export function table(columns: readonly string[], rows: readonly (readonly string[])[]): string {
  if (rows.length === 0) {
    return paragraph('No data is available for this table yet.');
  }
  const header = tableRow(columns, true);
  const body = rows.map((row) => tableRow(row, false)).join('');
  const properties = element('w:tblPr', [], voidElement('w:tblW', [['w:w', 0], ['w:type', 'auto']]), tableBorders());
  return element('w:tbl', [], properties, header, body);
}
