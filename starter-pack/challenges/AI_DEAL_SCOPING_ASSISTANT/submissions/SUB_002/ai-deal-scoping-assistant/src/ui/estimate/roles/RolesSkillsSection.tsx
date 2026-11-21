/** "Roles and skills" (spec 5: "Major workstreams", "Roles or skill categories"): role summary with cost, and skills per workstream. */
import type { ReactElement } from 'react';
import type { RoleAllocation, WorkstreamEstimate } from '../../../domain';
import { Card } from '../../common';
import { RoleAllocationTable } from '../workstreams/RoleAllocationTable';
import { SkillsByWorkstream } from './SkillsByWorkstream';

export interface RolesSkillsSectionProps {
  roleSummary: RoleAllocation[];
  workstreams: WorkstreamEstimate[];
  currency: string;
}

export function RolesSkillsSection({ roleSummary, workstreams, currency }: RolesSkillsSectionProps): ReactElement {
  return (
    <Card title="Roles and skills" subtitle="Total days, rate and cost per role across every workstream, plus the skills each workstream needs.">
      <div className="estimate-roles-grid">
        <div>
          <p className="estimate-subheading text-sm">Role summary</p>
          <RoleAllocationTable roles={roleSummary} currency={currency} caption="Total days, day rate and cost per role" />
        </div>
        <div>
          <p className="estimate-subheading text-sm">Skills by workstream</p>
          <SkillsByWorkstream workstreams={workstreams} />
        </div>
      </div>
    </Card>
  );
}
