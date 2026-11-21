/** Skills recommended for each workstream (spec 5: "Recommend roles and skills"). */
import type { ReactElement } from 'react';
import type { WorkstreamEstimate } from '../../../domain';
import { Badge, EmptyState } from '../../common';

export interface SkillsByWorkstreamProps {
  workstreams: WorkstreamEstimate[];
}

function SkillsRow({ workstream }: { workstream: WorkstreamEstimate }): ReactElement {
  return (
    <li className="skills-by-workstream-row">
      <p className="skills-by-workstream-name text-sm">{workstream.name}</p>
      {workstream.skills.length === 0 ? (
        <span className="text-subtle text-sm">No specific skills recorded</span>
      ) : (
        <span className="cluster">
          {workstream.skills.map((skill) => (
            <Badge key={skill} tone="teal">
              {skill}
            </Badge>
          ))}
        </span>
      )}
    </li>
  );
}

export function SkillsByWorkstream({ workstreams }: SkillsByWorkstreamProps): ReactElement {
  if (workstreams.length === 0) {
    return <EmptyState title="No skills yet" message="Skills appear per workstream once the estimate has been generated." />;
  }
  return (
    <ul className="stack stack-sm">
      {workstreams.map((workstream) => (
        <SkillsRow key={workstream.id} workstream={workstream} />
      ))}
    </ul>
  );
}
