import { describe, expect, it } from 'vitest';
import { element, escapeAttribute, escapeText, htmlDoctype, text, voidElement, xmlDeclaration } from './markupBuilder';

describe('escapeText / escapeAttribute', () => {
  it('escapes every reserved markup character', () => {
    expect(escapeText(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&apos;&amp;&apos;&lt;/a&gt;');
    expect(escapeAttribute(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&apos;&amp;&apos;&lt;/a&gt;');
  });

  it('leaves plain text untouched', () => {
    expect(escapeText('Member Portal')).toBe('Member Portal');
    expect(escapeAttribute('Member Portal')).toBe('Member Portal');
  });
});

describe('text', () => {
  it('escapes its argument the same way as escapeText', () => {
    expect(text('A & B < C')).toBe('A &amp; B &lt; C');
  });
});

describe('element', () => {
  it('renders an opening tag, attributes, children and a matching closing tag', () => {
    expect(element('p', [], text('hi'))).toBe('<p>hi</p>');
    expect(element('a', [['href', '#top']], text('Top'))).toBe('<a href="#top">Top</a>');
  });

  it('joins multiple children in order without extra separators', () => {
    expect(element('ul', [], element('li', [], text('One')), element('li', [], text('Two')))).toBe('<ul><li>One</li><li>Two</li></ul>');
  });

  it('escapes attribute values and omits attributes whose value is undefined', () => {
    const markup = element('div', [
      ['class', 'card & more'],
      ['data-count', 3],
      ['data-empty', undefined],
    ]);
    expect(markup).toBe('<div class="card &amp; more" data-count="3"></div>');
  });

  it('never leaves child markup un-escaped, so untrusted text must go through text() first', () => {
    const malicious = '<script>alert(1)</script>';
    expect(element('p', [], text(malicious))).not.toContain('<script>');
    expect(element('p', [], text(malicious))).toContain('&lt;script&gt;');
  });
});

describe('voidElement', () => {
  it('renders a self-closing tag with escaped attributes', () => {
    expect(voidElement('br', [])).toBe('<br/>');
    expect(voidElement('meta', [['charset', 'utf-8']])).toBe('<meta charset="utf-8"/>');
  });
});

describe('xmlDeclaration / htmlDoctype', () => {
  it('returns the fixed XML declaration used by every OOXML part', () => {
    expect(xmlDeclaration()).toBe('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
  });

  it('returns the fixed HTML5 doctype prologue', () => {
    expect(htmlDoctype()).toBe('<!DOCTYPE html>');
  });
});
