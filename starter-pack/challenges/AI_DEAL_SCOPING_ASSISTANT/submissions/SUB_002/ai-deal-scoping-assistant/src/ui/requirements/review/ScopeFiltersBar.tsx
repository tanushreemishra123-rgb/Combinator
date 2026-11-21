/** Secondary filters (provenance/priority/review/text search) for the scope items table. The
 * kind-group tabs live one level up, in `ReviewScopeStep`, since `Tabs` owns its whole tabpanel. */
import type { ReactElement } from 'react';
import { provenanceLabel, reviewLabel } from '../../../scope';
import { Field, Select, TextInput } from '../../common';
import type { SelectOption } from '../../common';
import { PRIORITY_FILTER_OPTIONS, PROVENANCE_FILTER_OPTIONS, REVIEW_FILTER_OPTIONS } from '../types';
import type { ScopeFilterState } from '../types';

export interface ScopeFiltersBarProps {
  filters: ScopeFilterState;
  onChange: (filters: ScopeFilterState) => void;
}

function toOptions<T extends string>(values: readonly T[], labelOf: (value: T) => string): SelectOption[] {
  return [{ value: 'all', label: 'All' }, ...values.map((value) => ({ value, label: labelOf(value) }))];
}

export function ScopeFiltersBar({ filters, onChange }: ScopeFiltersBarProps): ReactElement {
  return (
    <div className="requirements-filter-grid">
      <Field label="Provenance">
        {(props) => (
          <Select
            {...props}
            value={filters.provenance}
            options={toOptions(PROVENANCE_FILTER_OPTIONS, provenanceLabel)}
            onChange={(value) => onChange({ ...filters, provenance: value as ScopeFilterState['provenance'] })}
          />
        )}
      </Field>
      <Field label="Priority">
        {(props) => (
          <Select
            {...props}
            value={filters.priority}
            options={toOptions(PRIORITY_FILTER_OPTIONS, (value) => value)}
            onChange={(value) => onChange({ ...filters, priority: value as ScopeFilterState['priority'] })}
          />
        )}
      </Field>
      <Field label="Review state">
        {(props) => (
          <Select
            {...props}
            value={filters.review}
            options={toOptions(REVIEW_FILTER_OPTIONS, reviewLabel)}
            onChange={(value) => onChange({ ...filters, review: value as ScopeFilterState['review'] })}
          />
        )}
      </Field>
      <Field label="Search">
        {(props) => (
          <TextInput
            {...props}
            type="search"
            value={filters.search}
            placeholder="Search title, description or id"
            onChange={(value) => onChange({ ...filters, search: value })}
          />
        )}
      </Field>
    </div>
  );
}
