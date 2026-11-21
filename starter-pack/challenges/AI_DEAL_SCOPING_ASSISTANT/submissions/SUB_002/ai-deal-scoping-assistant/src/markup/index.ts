/**
 * Public surface of the shared markup-building module used by the SVG, HTML and DOCX exporters -
 * see `markupBuilder.ts` for behaviour and escaping rules.
 */
export type { Attribute, AttributeValue } from './markupBuilder';
export { element, escapeAttribute, escapeText, htmlDoctype, text, voidElement, xmlDeclaration } from './markupBuilder';
