/**
 * Renders the format-neutral `DocBlock[]` (src/domain/package.ts) as real React elements - never
 * HTML strings - so the same content model drives the on-screen preview and the exporters. Every
 * block type from the domain union is handled exhaustively; 'diagram' blocks defer to a
 * caller-supplied render-prop so this module never depends on the diagram renderer.
 */
import { Fragment } from 'react';
import type { ReactElement, ReactNode } from 'react';
import type { DocBlock } from '../../domain';
import { Callout } from './Callout';
import { KeyValueList } from './KeyValueList';

export interface DocBlocksProps {
  blocks: DocBlock[];
  renderDiagram?: (block: Extract<DocBlock, { type: 'diagram' }>) => ReactNode;
}

function renderHeading(block: Extract<DocBlock, { type: 'heading' }>, index: number): ReactElement {
  const HeadingTag = block.level === 3 ? 'h3' : 'h4';
  return (
    <HeadingTag key={index} className="doc-block-heading">
      {block.text}
    </HeadingTag>
  );
}

function renderTable(block: Extract<DocBlock, { type: 'table' }>, index: number): ReactElement {
  return (
    <div key={index} className="doc-block-table-scroll">
      <table className="doc-block-table">
        <thead>
          <tr>
            {block.columns.map((column, columnIndex) => (
              <th key={columnIndex} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderBlock(block: DocBlock, index: number, renderDiagram: DocBlocksProps['renderDiagram']): ReactElement {
  switch (block.type) {
    case 'paragraph':
      return (
        <p key={index} className="doc-block-paragraph">
          {block.text}
        </p>
      );
    case 'heading':
      return renderHeading(block, index);
    case 'list':
      return (
        <ul key={index} className="doc-block-list">
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{item}</li>
          ))}
        </ul>
      );
    case 'table':
      return renderTable(block, index);
    case 'callout':
      return (
        <Callout key={index} tone={block.tone} title={block.title}>
          {block.text}
        </Callout>
      );
    case 'keyValues':
      return (
        <div key={index} className="doc-block-key-values">
          <KeyValueList items={block.pairs.map((pair) => ({ key: pair.key, value: pair.value }))} />
        </div>
      );
    case 'diagram':
      return (
        <Fragment key={index}>
          {renderDiagram ? (
            renderDiagram(block)
          ) : (
            <p className="doc-block-diagram-fallback text-muted text-sm">{block.title} (diagram unavailable)</p>
          )}
        </Fragment>
      );
    default:
      return assertNever(block);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled doc block: ${JSON.stringify(value)}`);
}

export function DocBlocks({ blocks, renderDiagram }: DocBlocksProps): ReactElement {
  return <div className="doc-blocks">{blocks.map((block, index) => renderBlock(block, index, renderDiagram))}</div>;
}
