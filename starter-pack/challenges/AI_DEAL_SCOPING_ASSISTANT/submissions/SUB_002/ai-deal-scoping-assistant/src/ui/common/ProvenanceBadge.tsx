/**
 * Marks a scope item's place in the grounding hierarchy - customer-stated, AI-inferred, or
 * assumed - with a distinct colour and icon per the spec, plus a tooltip explaining the term.
 */
import type { ComponentType, ReactElement } from 'react';
import type { Provenance } from '../../domain';
import { Badge } from './Badge';
import type { BadgeTone } from './Badge';
import { HelpCircleIcon, SparklesIcon, UserIcon } from './icons';
import type { IconProps } from './icons';
import { Tooltip } from './Tooltip';

export interface ProvenanceBadgeProps {
  provenance: Provenance;
}

interface ProvenanceMeta {
  label: string;
  tone: BadgeTone;
  Icon: ComponentType<IconProps>;
  description: string;
}

const PROVENANCE_META: ReadonlyMap<Provenance, ProvenanceMeta> = new Map([
  [
    'customer-stated',
    {
      label: 'Customer-stated',
      tone: 'primary',
      Icon: UserIcon,
      description: 'Taken directly from the customer-provided requirements or documents.',
    },
  ],
  [
    'ai-inferred',
    {
      label: 'AI-inferred',
      tone: 'violet',
      Icon: SparklesIcon,
      description: 'Derived by the assistant from context and patterns in the requirements, not stated verbatim.',
    },
  ],
  [
    'assumed',
    {
      label: 'Assumed',
      tone: 'warning',
      Icon: HelpCircleIcon,
      description: 'Filled in by the assistant where the customer did not provide enough information - needs human validation.',
    },
  ],
]);

const FALLBACK_META: ProvenanceMeta = {
  label: 'Unknown',
  tone: 'neutral',
  Icon: HelpCircleIcon,
  description: 'Source of this statement is unknown.',
};

export function ProvenanceBadge({ provenance }: ProvenanceBadgeProps): ReactElement {
  const meta = PROVENANCE_META.get(provenance) ?? FALLBACK_META;

  return (
    <Tooltip content={meta.description}>
      <span tabIndex={0} className="provenance-trigger">
        <Badge tone={meta.tone} icon={<meta.Icon size={12} />}>
          {meta.label}
        </Badge>
      </span>
    </Tooltip>
  );
}
