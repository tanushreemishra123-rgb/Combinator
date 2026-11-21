/**
 * One node box: a wrapped label, the service/system sublabel, and a requirement-refs line -
 * dashed when the node is external. Interactive (clickable and keyboard-activatable) whenever the
 * caller supplied `onSelect`; otherwise a plain, non-focusable shape.
 */
import type { KeyboardEvent, ReactElement } from 'react';
import {
  NODE_LABEL_FONT_SIZE,
  NODE_LABEL_MAX_CHARS,
  NODE_LABEL_MAX_LINES,
  NODE_REFS_MAX_CHARS,
  NODE_SUBLABEL_MAX_CHARS,
  truncateText,
  wrapLabelToLines,
} from '../../diagram';
import type { LaidOutNode } from '../../diagram';

export interface DiagramNodeProps {
  node: LaidOutNode;
  onSelect?: () => void;
}

const LABEL_LINE_HEIGHT = NODE_LABEL_FONT_SIZE + 2;
const LABEL_TOP_INSET = 18;
const SUBLABEL_GAP = 4;
const REFS_BOTTOM_INSET = 8;

function refsLine(refs: readonly string[]): string {
  return refs.length === 0 ? 'No linked requirements' : `Refs: ${refs.join(', ')}`;
}

function nodeClassName(node: LaidOutNode, interactive: boolean): string {
  const classes = ['diagram-node', node.external ? 'diagram-node-external' : '', interactive ? 'diagram-node-interactive' : ''];
  return classes.filter((value) => value.length > 0).join(' ');
}

export function DiagramNode({ node, onSelect }: DiagramNodeProps): ReactElement {
  const labelLines = wrapLabelToLines(node.label, NODE_LABEL_MAX_CHARS, NODE_LABEL_MAX_LINES);
  const labelX = node.x + node.width / 2;
  const labelStartY = node.y + LABEL_TOP_INSET;
  const sublabelY = labelStartY + labelLines.length * LABEL_LINE_HEIGHT + SUBLABEL_GAP;
  const refsY = node.y + node.height - REFS_BOTTOM_INSET;
  const refsText = refsLine(node.refs);
  const interactive = onSelect !== undefined;

  function handleKeyDown(event: KeyboardEvent<SVGGElement>): void {
    if (onSelect !== undefined && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onSelect();
    }
  }

  return (
    <g
      className={nodeClassName(node, interactive)}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? `${node.label}. ${node.sublabel}. ${refsText}` : undefined}
      onClick={interactive ? onSelect : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
    >
      <rect x={node.x} y={node.y} width={node.width} height={node.height} rx={6} className="diagram-node-box" />
      <text x={labelX} y={labelStartY} textAnchor="middle" className="diagram-node-label">
        {labelLines.map((line, index) => (
          <tspan key={`${index}-${line}`} x={labelX} y={labelStartY + index * LABEL_LINE_HEIGHT}>
            {line}
          </tspan>
        ))}
      </text>
      {node.sublabel.trim().length > 0 ? (
        <text x={labelX} y={sublabelY} textAnchor="middle" className="diagram-node-sublabel">
          {truncateText(node.sublabel, NODE_SUBLABEL_MAX_CHARS)}
        </text>
      ) : null}
      <text x={labelX} y={refsY} textAnchor="middle" className="diagram-node-refs">
        {truncateText(refsText, NODE_REFS_MAX_CHARS)}
      </text>
    </g>
  );
}
