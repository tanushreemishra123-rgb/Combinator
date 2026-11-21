/** Renders a pointer into the normalised customer text (section + line range) as an openable link. */
import type { ReactElement } from 'react';
import type { SourceRef } from '../../domain';
import { FileTextIcon } from './icons';

export interface SourceRefLinkProps {
  source: SourceRef;
  onOpen?: (source: SourceRef) => void;
}

export function SourceRefLink({ source, onOpen }: SourceRefLinkProps): ReactElement {
  const label = source.sectionTitle.length > 0 ? source.sectionTitle : 'Source section';
  const lines = source.lineEnd > source.lineStart ? `lines ${source.lineStart}-${source.lineEnd}` : `line ${source.lineStart}`;

  if (!onOpen) {
    return (
      <span className="source-ref-link source-ref-static text-sm">
        <FileTextIcon size={14} />
        {label} - {lines}
      </span>
    );
  }

  return (
    <button type="button" className="source-ref-link text-sm" onClick={() => onOpen(source)}>
      <FileTextIcon size={14} />
      {label} - {lines}
    </button>
  );
}
