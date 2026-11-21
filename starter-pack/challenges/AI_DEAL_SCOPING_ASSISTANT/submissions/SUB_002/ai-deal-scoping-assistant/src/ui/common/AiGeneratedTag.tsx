/** Small, unmissable marker for AI-authored recommendations, per the spec's labelling requirement. */
import type { ReactElement } from 'react';
import { SparklesIcon } from './icons';

export interface AiGeneratedTagProps {
  label?: string;
}

export function AiGeneratedTag({ label = 'AI-generated recommendation' }: AiGeneratedTagProps): ReactElement {
  return (
    <span className="ai-generated-tag">
      <SparklesIcon size={12} />
      {label}
    </span>
  );
}
