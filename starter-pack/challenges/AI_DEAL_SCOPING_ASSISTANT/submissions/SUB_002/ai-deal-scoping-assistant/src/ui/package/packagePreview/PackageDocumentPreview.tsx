/**
 * Integrated package preview (spec "Recommended Application Sections 6": "Integrated package
 * preview"). Renders the same format-neutral `PackageDocument` the exporters render, through
 * `DocBlocks`, so the on-screen preview never drifts from what gets exported. Diagram blocks defer
 * to `DiagramView` with the renderer-neutral models `buildPackageDiagrams` computed from
 * `buildArchitectureDiagram` / `buildDataFlowDiagram`.
 */
import type { ReactElement, ReactNode } from 'react';
import type { DiagramModel, DocBlock, PackageDocument, PackageSection } from '../../../domain';
import type { PackageDiagramId } from '../../../export';
import { DocBlocks } from '../../common';
import { DiagramView } from '../../diagram';

export interface PackageDocumentPreviewProps {
  document: PackageDocument;
  diagrams: ReadonlyMap<PackageDiagramId, DiagramModel>;
}

function renderDiagramBlock(block: Extract<DocBlock, { type: 'diagram' }>, diagrams: ReadonlyMap<PackageDiagramId, DiagramModel>): ReactNode {
  const model = diagrams.get(block.diagramId);
  if (model === undefined) {
    return <p className="doc-block-diagram-fallback text-muted text-sm">{block.title} (not generated yet)</p>;
  }
  return <DiagramView model={model} ariaLabel={block.title} />;
}

function PackageSectionBlock({ section, diagrams }: { section: PackageSection; diagrams: ReadonlyMap<PackageDiagramId, DiagramModel> }): ReactElement {
  return (
    <section id={section.id} className="package-preview-section">
      <h3 className="package-preview-section-title">{section.title}</h3>
      <DocBlocks blocks={section.blocks} renderDiagram={(block) => renderDiagramBlock(block, diagrams)} />
    </section>
  );
}

export function PackageDocumentPreview({ document, diagrams }: PackageDocumentPreviewProps): ReactElement {
  return (
    <article className="package-preview-document">
      <header className="package-preview-header">
        <h2 className="package-preview-title">{document.title}</h2>
        <p className="text-muted">{document.subtitle}</p>
      </header>
      <div className="stack stack-lg">
        {document.sections.map((section) => (
          <PackageSectionBlock key={section.id} section={section} diagrams={diagrams} />
        ))}
      </div>
    </article>
  );
}
