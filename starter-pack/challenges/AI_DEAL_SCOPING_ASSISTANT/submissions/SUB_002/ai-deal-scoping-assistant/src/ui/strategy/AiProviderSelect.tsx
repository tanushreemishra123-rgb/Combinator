/** AI-provider preference selector (SolutionConfig.aiProviderPreference), routed through the state config use case by the caller. */
import type { ReactElement } from 'react';
import type { AiProviderPreference } from '../../domain';
import { Field, Select } from '../common';

export interface AiProviderSelectProps {
  value: AiProviderPreference;
  disabled: boolean;
  onChange: (value: AiProviderPreference) => void;
}

const OPTIONS: { value: AiProviderPreference; label: string }[] = [
  { value: 'cloud-native', label: "Cloud-native (the platform's own managed AI service)" },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'open-source', label: 'Open-source models' },
  { value: 'no-preference', label: 'No preference' },
];

const KNOWN_PREFERENCES: ReadonlySet<string> = new Set(OPTIONS.map((option) => option.value));

function isAiProviderPreference(value: string): value is AiProviderPreference {
  return KNOWN_PREFERENCES.has(value);
}

export function AiProviderSelect({ value, disabled, onChange }: AiProviderSelectProps): ReactElement {
  return (
    <Field
      label="AI provider preference"
      hint="Used the next time the AI solution approach is generated - model and provider options in every use case follow this choice."
    >
      {(controlProps) => (
        <Select
          {...controlProps}
          value={value}
          disabled={disabled}
          options={OPTIONS}
          onChange={(next) => {
            if (isAiProviderPreference(next)) {
              onChange(next);
            }
          }}
        />
      )}
    </Field>
  );
}
