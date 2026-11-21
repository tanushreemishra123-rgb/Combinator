/** Converts `PackageDocument` sections and blocks into WordprocessingML paragraph/table fragments. */
import type { DocBlock, PackageSection } from '../../domain';
import { diagramFlowLines, diagramTiers } from './diagramText';
import { bulletList, calloutParagraphs, headingParagraph, paragraph, table } from './wordXml';

function diagramBlockXml(block: Extract<DocBlock, { type: 'diagram' }>): string {
  const tiers = diagramTiers(block.mermaid);
  const flows = diagramFlowLines(block.mermaid);
  const tierXml =
    tiers.length === 0
      ? paragraph('No diagram elements to display yet.')
      : tiers.map((tier) => headingParagraph(4, tier.label) + (tier.nodes.length === 0 ? paragraph('No nodes in this tier.') : bulletList(tier.nodes))).join('');
  const flowXml = flows.length === 0 ? paragraph('No flows to display yet.') : bulletList(flows);
  return headingParagraph(3, block.title) + headingParagraph(4, 'Nodes by tier') + tierXml + headingParagraph(4, 'Flows') + flowXml;
}

function keyValuesXml(pairs: readonly { key: string; value: string }[]): string {
  return bulletList(pairs.map((pair) => `${pair.key}: ${pair.value}`));
}

/** Renders one `DocBlock` to WordprocessingML. */
export function blockToXml(block: DocBlock): string {
  switch (block.type) {
    case 'paragraph':
      return paragraph(block.text);
    case 'heading':
      return headingParagraph(block.level, block.text);
    case 'list':
      return bulletList(block.items);
    case 'table':
      return table(block.columns, block.rows);
    case 'callout':
      return calloutParagraphs(block.title, block.text);
    case 'keyValues':
      return keyValuesXml(block.pairs);
    case 'diagram':
      return diagramBlockXml(block);
  }
}

/** Renders one package section: a level-1 heading followed by its blocks in order. */
export function sectionToXml(section: PackageSection): string {
  return headingParagraph(1, section.title) + section.blocks.map(blockToXml).join('');
}
