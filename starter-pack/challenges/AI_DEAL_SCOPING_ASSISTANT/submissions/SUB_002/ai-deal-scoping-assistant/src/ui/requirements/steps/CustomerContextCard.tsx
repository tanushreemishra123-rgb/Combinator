/** Customer and opportunity context form (spec "Recommended Application Sections 1"). */
import type { ReactElement } from 'react';
import type { CustomerContext } from '../../../domain';
import { Card, Field, TextArea, TextInput } from '../../common';

export interface CustomerContextCardProps {
  customer: CustomerContext;
  onChange: (patch: Partial<CustomerContext>) => void;
}

export function CustomerContextCard({ customer, onChange }: CustomerContextCardProps): ReactElement {
  return (
    <Card title="Customer and opportunity context" subtitle="Grounds the analysis and every downstream deliverable in who this is for.">
      <div className="requirements-form-grid">
        <Field label="Customer name">{(props) => <TextInput {...props} value={customer.customerName} onChange={(value) => onChange({ customerName: value })} />}</Field>
        <Field label="Industry">{(props) => <TextInput {...props} value={customer.industry} onChange={(value) => onChange({ industry: value })} />}</Field>
        <Field label="Opportunity name">
          {(props) => <TextInput {...props} value={customer.opportunityName} onChange={(value) => onChange({ opportunityName: value })} />}
        </Field>
        <Field label="Region">{(props) => <TextInput {...props} value={customer.region} onChange={(value) => onChange({ region: value })} />}</Field>
        <Field label="Engagement type" hint="e.g. Fixed-scope delivery, time and materials, staff augmentation">
          {(props) => <TextInput {...props} value={customer.engagementType} onChange={(value) => onChange({ engagementType: value })} />}
        </Field>
      </div>
      <Field label="Notes" hint="Anything else about the customer or opportunity worth keeping in view.">
        {(props) => <TextArea {...props} rows={3} value={customer.notes} onChange={(value) => onChange({ notes: value })} />}
      </Field>
    </Card>
  );
}
