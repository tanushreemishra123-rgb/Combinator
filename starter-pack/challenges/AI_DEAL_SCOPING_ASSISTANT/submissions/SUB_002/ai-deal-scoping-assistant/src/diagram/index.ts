/**
 * Renderer-neutral diagram module (see `src/domain/diagram.ts`): one deterministic layout algorithm
 * (`layoutDiagram`), a standalone escaped SVG string for exports (`diagramToSvg`) and Mermaid flow
 * chart text (`diagramToMermaid`). The architecture and data-flow planners build the `DiagramModel`;
 * this module only ever renders it.
 */
export * from './constants';
export * from './layout';
export * from './svg';
export * from './mermaid';
export { wrapLabelToLines, truncateText } from './wrap';
