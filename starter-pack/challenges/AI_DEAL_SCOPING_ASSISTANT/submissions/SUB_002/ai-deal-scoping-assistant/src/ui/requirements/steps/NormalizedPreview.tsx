/** Live "Normalized content preview" of the text currently in the input box (spec "Recommended Application Sections 1"). */
import type { ReactElement } from 'react';
import type { NormalizedDocument } from '../../../domain';
import { Card } from '../../common';
import { pluralize } from '../../common/format';
import { NormalizedTextView } from '../NormalizedTextView';

export interface NormalizedPreviewProps {
  preview: NormalizedDocument;
}

export function NormalizedPreview({ preview }: NormalizedPreviewProps): ReactElement {
  return (
    <Card
      title="Normalized content preview"
      subtitle={`${pluralize(preview.sections.length, 'section')} - ${pluralize(preview.wordCount, 'word')}, updated as you type.`}
      padded={false}
    >
      <div className="requirements-preview-scroll">
        <NormalizedTextView document={preview} />
      </div>
    </Card>
  );
}
