/** Step-by-step "Calculation" list (spec 5: "reproducible from visible scope factors ... or documented calculation rules"). */
import type { ReactElement } from 'react';

export interface CalculationListProps {
  steps: string[];
}

export function CalculationList({ steps }: CalculationListProps): ReactElement {
  return (
    <ol className="stack stack-xs calculation-list">
      {steps.map((step) => (
        <li key={step} className="text-sm">
          {step}
        </li>
      ))}
    </ol>
  );
}
