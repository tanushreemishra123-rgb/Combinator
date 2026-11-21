/**
 * Renders a `PackageDocument` as a single downloadable Markdown file (spec 6: "exportable in at
 * least one readable format"): title, status line, the mandatory disclaimer in a blockquote at the
 * top and again at the end, a table of contents, then every section's blocks as GitHub-flavoured
 * Markdown (tables with escaped pipes, Mermaid code fences for diagram blocks).
 */
import type { DocBlock, PackageDocument, PackageSection } from '../domain';
import type { CalloutTone } from './text';
import { formatTimestamp, slugify } from './text';

/** Escapes a table cell: pipes would otherwise split the column, and a raw newline would break the row. */
function escapeCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function renderTable(columns: readonly string[], rows: readonly (readonly string[])[]): string {
  const header = `| ${columns.map(escapeCell).join(' | ')} |`;
  const divider = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${row.map(escapeCell).join(' | ')} |`);
  return [header, divider, ...body].join('\n');
}

const CALLOUT_LABEL: ReadonlyMap<CalloutTone, string> = new Map([
  ['info', 'Note'],
  ['warning', 'Warning'],
  ['danger', 'Blocked'],
  ['success', 'Ready'],
]);

function renderCallout(tone: CalloutTone, title: string, text: string): string {
  const label = CALLOUT_LABEL.get(tone) ?? 'Note';
  return `> **${label} - ${title}**\n>\n> ${text}`;
}

function renderBlock(block: DocBlock): string {
  switch (block.type) {
    case 'paragraph':
      return block.text;
    case 'heading':
      return `${'#'.repeat(block.level)} ${block.text}`;
    case 'list':
      return block.items.map((item) => `- ${item}`).join('\n');
    case 'table':
      return renderTable(block.columns, block.rows);
    case 'callout':
      return renderCallout(block.tone, block.title, block.text);
    case 'keyValues':
      return block.pairs.map((pair) => `- **${pair.key}:** ${pair.value}`).join('\n');
    case 'diagram':
      return `**${block.title}**\n\n\`\`\`mermaid\n${block.mermaid}\n\`\`\``;
  }
}

function renderSection(section: PackageSection): string {
  const anchorTitle = `## ${section.title}`;
  return [anchorTitle, ...section.blocks.map(renderBlock)].join('\n\n');
}

function renderTableOfContents(sections: readonly PackageSection[]): string {
  const items = sections.map((section) => `- [${section.title}](#${slugify(section.title)})`);
  return ['## Table of contents', items.join('\n')].join('\n\n');
}

function renderDisclaimer(disclaimer: string): string {
  return `> ${disclaimer}`;
}

/**
 * Assembles the full Markdown document. The disclaimer is repeated verbatim at the top and the
 * bottom so it survives being read from either end of a long, scrolled document.
 */
export function toMarkdown(doc: PackageDocument): string {
  const parts = [
    `# ${doc.title}`,
    `*${doc.subtitle}*`,
    `**Generated:** ${formatTimestamp(doc.generatedAt)} · **AI mode:** ${doc.aiModeLabel} · **Export status:** ${doc.exportStatus}`,
    renderDisclaimer(doc.disclaimer),
    renderTableOfContents(doc.sections),
    ...doc.sections.map(renderSection),
    renderDisclaimer(doc.disclaimer),
  ];
  return parts.join('\n\n');
}
