/** One of the twelve pre-export quality checks (spec 6, "Quality Gate"), expandable to its findings. */
import type { ComponentType, ReactElement } from 'react';
import type { QualityCheck, QualityFinding } from '../../../domain';
import { Badge, Disclosure, RefChips } from '../../common';
import type { BadgeTone } from '../../common';
import { AlertCircleIcon, AlertTriangleIcon, CheckCircleIcon } from '../../common/icons';
import type { IconProps } from '../../common/icons';
import { useRefNavigation } from '../navigationRefs';

export interface QualityCheckRowProps {
  check: QualityCheck;
}

interface StatusMeta {
  label: string;
  tone: BadgeTone;
  Icon: ComponentType<IconProps>;
}

const STATUS_META: ReadonlyMap<QualityCheck['status'], StatusMeta> = new Map([
  ['pass', { label: 'Pass', tone: 'success', Icon: CheckCircleIcon }],
  ['warn', { label: 'Warning', tone: 'warning', Icon: AlertTriangleIcon }],
  ['fail', { label: 'Fail', tone: 'danger', Icon: AlertCircleIcon }],
]);

function FindingRow({ finding, onSelectRef }: { finding: QualityFinding; onSelectRef: (id: string) => void }): ReactElement {
  return (
    <li className="quality-finding-row">
      <p className="text-sm">{finding.message}</p>
      {finding.refs.length > 0 ? <RefChips refs={finding.refs} onSelect={onSelectRef} /> : null}
    </li>
  );
}

export function QualityCheckRow({ check }: QualityCheckRowProps): ReactElement {
  const onSelectRef = useRefNavigation();
  const meta = STATUS_META.get(check.status) ?? STATUS_META.get('pass');
  const countLabel = check.count === 1 ? '1 finding' : `${check.count} findings`;

  return (
    <div className="quality-check-row">
      <div className="cluster quality-check-row-header">
        {meta ? (
          <Badge tone={meta.tone} icon={<meta.Icon size={12} />}>
            {meta.label}
          </Badge>
        ) : null}
        <Disclosure summary={`${check.label} - ${countLabel}`}>
          <p className="text-sm text-muted">{check.description}</p>
          {check.findings.length === 0 ? (
            <p className="text-sm text-subtle">No findings for this check.</p>
          ) : (
            <ul className="stack stack-xs quality-findings-list">
              {check.findings.map((finding, index) => (
                <FindingRow key={`${check.id}-${index}`} finding={finding} onSelectRef={onSelectRef} />
              ))}
            </ul>
          )}
        </Disclosure>
      </div>
    </div>
  );
}
