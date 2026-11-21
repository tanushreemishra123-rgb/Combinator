/**
 * "Confidence and missing inputs" (spec 5, constraints: "Missing estimation inputs must reduce
 * confidence or block the affected calculation rather than being silently replaced"). Every entry
 * names what is missing, its effect, what it affects, and exactly how to resolve it.
 */
import type { ReactElement } from 'react';
import type { MissingEstimationInput } from '../../../domain';
import { Badge, Card, EmptyState, RefChips } from '../../common';
import type { BadgeTone } from '../../common';

export interface ConfidenceSectionProps {
  missingInputs: MissingEstimationInput[];
  onSelectRequirement: (id: string) => void;
}

const EFFECT_LABELS: ReadonlyMap<MissingEstimationInput['effect'], { label: string; tone: BadgeTone }> = new Map([
  ['confidence-reduced', { label: 'Confidence reduced', tone: 'warning' }],
  ['calculation-blocked', { label: 'Calculation blocked', tone: 'danger' }],
]);

function EffectBadge({ effect }: { effect: MissingEstimationInput['effect'] }): ReactElement {
  const meta = EFFECT_LABELS.get(effect) ?? { label: effect, tone: 'neutral' as const };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

function MissingInputRow({ missing, onSelectRequirement }: { missing: MissingEstimationInput; onSelectRequirement: (id: string) => void }): ReactElement {
  return (
    <li className="missing-input-row stack stack-xs">
      <div className="cluster">
        <strong>{missing.label}</strong>
        <EffectBadge effect={missing.effect} />
      </div>
      <p className="text-sm text-muted">
        Affects: {missing.affected.length === 0 ? 'the overall estimate' : missing.affected.join(', ')}
      </p>
      {missing.relatedScopeIds.length > 0 ? <RefChips refs={missing.relatedScopeIds} onSelect={onSelectRequirement} /> : null}
      <p className="text-sm">{missing.howToResolve}</p>
    </li>
  );
}

export function ConfidenceSection({ missingInputs, onSelectRequirement }: ConfidenceSectionProps): ReactElement {
  return (
    <Card title="Confidence and missing inputs" subtitle="Every input the calculation could not confirm, its effect, and how to resolve it.">
      {missingInputs.length === 0 ? (
        <EmptyState title="No missing inputs" message="Every planning input, rate and base-effort value the calculation needs is configured." />
      ) : (
        <ul className="stack stack-md">
          {missingInputs.map((missing) => (
            <MissingInputRow key={`${missing.key}-${missing.label}`} missing={missing} onSelectRequirement={onSelectRequirement} />
          ))}
        </ul>
      )}
    </Card>
  );
}
