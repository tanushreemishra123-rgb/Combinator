/** Source panel: opens scrolled to and highlighting a scope item's source lines, quote emphasised. */
import type { ReactElement } from 'react';
import type { NormalizedDocument, ScopeItem } from '../../../domain';
import { Callout, Drawer, EmptyState } from '../../common';
import { NormalizedTextView } from '../NormalizedTextView';

export interface SourcePanelDrawerProps {
  open: boolean;
  item: ScopeItem | null;
  document: NormalizedDocument | null;
  onClose: () => void;
}

export function SourcePanelDrawer({ open, item, document, onClose }: SourcePanelDrawerProps): ReactElement | null {
  if (item === null) {
    return null;
  }

  return (
    <Drawer open={open} title={`Source for ${item.id}`} onClose={onClose} side="end">
      <div className="stack stack-md">
        <p className="text-muted text-sm">{item.title}</p>
        {item.source === null ? (
          <EmptyState title="No source reference" message="This item has no recorded pointer into the customer text." />
        ) : document === null ? (
          <EmptyState title="Normalized text unavailable" message="Paste or upload the requirements text to see the source passage." />
        ) : (
          <>
            {!item.source.verified ? (
              <Callout tone="warning" title="Unverified source">
                The quoted wording could not be located in the normalized text - it may have been edited or paraphrased after extraction.
              </Callout>
            ) : null}
            <div className="requirements-preview-scroll requirements-source-panel-scroll">
              <NormalizedTextView document={document} highlightStart={item.source.lineStart} highlightEnd={item.source.lineEnd} quote={item.source.quote} />
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}
