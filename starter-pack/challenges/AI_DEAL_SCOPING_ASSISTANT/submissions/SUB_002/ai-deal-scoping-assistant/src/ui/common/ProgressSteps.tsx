/** Compact step tracker (e.g. within a wizard-like flow inside a workspace). */
import type { ReactElement } from 'react';
import { CheckIcon } from './icons';

export interface ProgressStep {
  id: string;
  label: string;
  status: 'complete' | 'current' | 'upcoming';
}

export interface ProgressStepsProps {
  steps: ProgressStep[];
  orientation?: 'horizontal' | 'vertical';
}

export function ProgressSteps({ steps, orientation = 'horizontal' }: ProgressStepsProps): ReactElement {
  return (
    <ol className={`progress-steps progress-steps-${orientation}`}>
      {steps.map((step, index) => (
        <li key={step.id} className={`progress-step progress-step-${step.status}`}>
          <span className="progress-step-marker" aria-hidden="true">
            {step.status === 'complete' ? <CheckIcon size={12} /> : index + 1}
          </span>
          <span className="progress-step-label">{step.label}</span>
        </li>
      ))}
    </ol>
  );
}
