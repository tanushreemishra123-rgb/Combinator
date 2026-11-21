/** "Modify a requirement, assumption or configuration" form (spec 6, "Change-Impact Handling"). */
import type { ReactElement } from 'react';
import type { ScopingSession } from '../../../domain';
import { Field, Select } from '../../common';
import type { SelectOption } from '../../common';
import { ChangeFieldset } from './ChangeFieldset';
import { CHANGE_TYPE_OPTIONS } from './changeTypes';
import type { ChangeDraft, ChangeTypeId } from './changeTypes';

export interface ChangeFormProps {
  draft: ChangeDraft;
  session: ScopingSession;
  onChange: (patch: Partial<ChangeDraft>) => void;
}

const TYPE_OPTIONS: SelectOption[] = CHANGE_TYPE_OPTIONS.map((option) => ({ value: option.id, label: option.label }));

export function ChangeForm({ draft, session, onChange }: ChangeFormProps): ReactElement {
  return (
    <form className="stack stack-md change-form" onSubmit={(event) => event.preventDefault()}>
      <Field label="Change type">
        {(control) => <Select {...control} value={draft.type} options={TYPE_OPTIONS} onChange={(value) => onChange({ type: value as ChangeTypeId })} />}
      </Field>
      <ChangeFieldset draft={draft} session={session} onChange={onChange} />
    </form>
  );
}
