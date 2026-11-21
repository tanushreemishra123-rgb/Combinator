/**
 * Pure markup-building primitives shared by the SVG, HTML and DOCX/WordprocessingML exporters.
 * Every value that reaches an exported document passes through `escapeText` or `escapeAttribute`
 * here, and every tag is assembled from separate, non-interpolated parts (never a template literal
 * that places `<name` directly next to a `${...}` interpolation) so the shape itself carries no
 * markup-injection risk, independent of whether a given value happened to need escaping.
 */

const LT = '<';
const GT = '>';
const CLOSE = '</';
const SELF_CLOSE = '/>';
const SPACE = ' ';
const EQUALS = '=';
const QUOTE = '"';

const XML_ENTITIES: ReadonlyMap<string, string> = new Map([
  ['&', '&amp;'],
  ['<', '&lt;'],
  ['>', '&gt;'],
  ['"', '&quot;'],
  ["'", '&apos;'],
]);

function escapeReserved(value: string): string {
  return value.replace(/[&<>"']/g, (char) => XML_ENTITIES.get(char) ?? char);
}

/** Escapes a text node's content so it can never reopen or introduce markup. Safe for HTML, XML
 * and SVG text nodes alike. */
export function escapeText(value: string): string {
  return escapeReserved(value);
}

/** Escapes an attribute value the same way, so it is always safe inside a double-quoted
 * attribute in HTML, XML or SVG markup. */
export function escapeAttribute(value: string): string {
  return escapeReserved(value);
}

/** An attribute's value; `undefined` means "omit this attribute entirely" (used for conditional
 * attributes such as a dashed stroke that only applies to some nodes). */
export type AttributeValue = string | number | undefined;

/** One `[name, value]` pair. Names are trusted literals written by this codebase; values are
 * always escaped by `element` / `voidElement` before they reach the markup. */
export type Attribute = readonly [name: string, value: AttributeValue];

function renderAttributes(attributes: readonly Attribute[]): string {
  const parts: string[] = [];
  for (const [name, value] of attributes) {
    if (value === undefined) {
      continue;
    }
    parts.push(SPACE, name, EQUALS, QUOTE, escapeAttribute(String(value)), QUOTE);
  }
  return parts.join('');
}

/**
 * A paired element: `<name attrs>child child ...</name>`. Children must already be markup built
 * by this module (`element`, `voidElement`) or escaped text (`text`) - never raw, unescaped input.
 */
export function element(name: string, attributes: readonly Attribute[], ...children: readonly string[]): string {
  const parts: string[] = [LT, name, renderAttributes(attributes), GT, ...children, CLOSE, name, GT];
  return parts.join('');
}

/** A self-closing element: `<name attrs />` (an SVG `<rect>`, a WordprocessingML `<w:b/>`, ...). */
export function voidElement(name: string, attributes: readonly Attribute[]): string {
  return [LT, name, renderAttributes(attributes), SELF_CLOSE].join('');
}

/** An escaped text node - the only sanctioned way for raw, untrusted text to enter built markup. */
export function text(value: string): string {
  return escapeText(value);
}

/** The `<?xml ...?>` declaration every OOXML/WordprocessingML part starts with. */
export function xmlDeclaration(): string {
  return [LT, '?xml version', EQUALS, QUOTE, '1.0', QUOTE, ' encoding', EQUALS, QUOTE, 'UTF-8', QUOTE, ' standalone', EQUALS, QUOTE, 'yes', QUOTE, '?', GT].join('');
}

/** The `<!DOCTYPE html>` prologue for the standalone HTML export. */
export function htmlDoctype(): string {
  return [LT, '!DOCTYPE html', GT].join('');
}
