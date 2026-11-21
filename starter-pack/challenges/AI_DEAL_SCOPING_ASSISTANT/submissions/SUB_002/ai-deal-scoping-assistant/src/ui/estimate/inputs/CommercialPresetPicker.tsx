/** Example commercial configurations (spec 3, "Seed Content"): applying one replaces the whole commercial configuration below. */
import type { ReactElement } from 'react';
import { COMMERCIAL_PRESETS } from '../../../seed';
import { Button, Card } from '../../common';

export interface CommercialPresetPickerProps {
  disabled: boolean;
  onApply: (presetId: string) => void;
}

export function CommercialPresetPicker({ disabled, onApply }: CommercialPresetPickerProps): ReactElement {
  return (
    <Card title="Commercial presets" subtitle="Illustrative planning configurations; applying one replaces the currency, contingency and rate card below.">
      <ul className="stack stack-sm commercial-preset-list">
        {COMMERCIAL_PRESETS.map((preset) => (
          <li key={preset.id} className="commercial-preset-row">
            <div>
              <p className="commercial-preset-label">{preset.label}</p>
              <p className="text-muted text-sm">{preset.description}</p>
            </div>
            <Button variant="secondary" size="sm" disabled={disabled} onClick={() => onApply(preset.id)}>
              Apply
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
