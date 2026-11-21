/**
 * "Recommended enhancements" section (spec: distinguish "Recommended enhancements" from
 * customer-requested scope). Always tagged with `AiGeneratedTag` so it reads as a suggestion the
 * reviewer must confirm, never as part of what the customer asked for.
 */
import type { ReactElement } from 'react';
import type { Capability } from '../../domain';
import { AiGeneratedTag, Card, EmptyState } from '../common';
import { CapabilityCard } from './CapabilityCard';

export interface RecommendedEnhancementsProps {
  enhancements: Capability[];
  onSelectRequirement: (id: string) => void;
}

export function RecommendedEnhancements({ enhancements, onSelectRequirement }: RecommendedEnhancementsProps): ReactElement {
  return (
    <Card
      title={
        <span className="cluster">
          <span>Recommended enhancements</span>
          <AiGeneratedTag />
        </span>
      }
      subtitle="AI-generated recommendations beyond the customer-requested scope - review and confirm before committing them to delivery."
    >
      {enhancements.length === 0 ? (
        <EmptyState title="No enhancements suggested" message="Nothing in the reviewed requirements triggered a recommended enhancement." />
      ) : (
        <div className="capability-flat-list">
          {enhancements.map((capability) => (
            <CapabilityCard key={capability.id} capability={capability} onSelectRequirement={onSelectRequirement} />
          ))}
        </div>
      )}
    </Card>
  );
}
