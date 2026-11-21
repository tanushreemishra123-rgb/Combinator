/**
 * Small badges specific to this workspace, composed from the shared Badge (spec 4: data
 * classification, internal/external systems, API readiness, and the AI/deterministic/human split).
 */
import type { ComponentType, ReactElement } from 'react';
import type { DataDomain, IntegrationSpec, ProcessingType } from '../../domain';
import { AlertTriangleIcon, Badge, CheckCircleIcon, ExternalLinkIcon, SparklesIcon, Tooltip, UserIcon } from '../common';
import type { BadgeTone, IconProps } from '../common';

export interface ClassificationBadgeProps {
  classification: DataDomain['classification'];
}

interface BadgeMeta {
  label: string;
  tone: BadgeTone;
}

const CLASSIFICATION_META: ReadonlyMap<DataDomain['classification'], BadgeMeta> = new Map([
  ['public', { label: 'Public', tone: 'info' }],
  ['internal', { label: 'Internal', tone: 'neutral' }],
  ['confidential', { label: 'Confidential', tone: 'warning' }],
  ['regulated', { label: 'Regulated', tone: 'danger' }],
]);

export function ClassificationBadge({ classification }: ClassificationBadgeProps): ReactElement {
  const meta = CLASSIFICATION_META.get(classification) ?? { label: classification, tone: 'neutral' };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export interface SystemTypeBadgeProps {
  systemType: IntegrationSpec['systemType'];
}

export function SystemTypeBadge({ systemType }: SystemTypeBadgeProps): ReactElement {
  if (systemType === 'internal') {
    return <Badge tone="primary">Internal system</Badge>;
  }
  return (
    <Badge tone="teal" icon={<ExternalLinkIcon size={12} />}>
      External system
    </Badge>
  );
}

export interface ReadinessBadgeProps {
  readiness: IntegrationSpec['readiness'];
}

export function ReadinessBadge({ readiness }: ReadinessBadgeProps): ReactElement {
  if (readiness === 'confirmed') {
    return (
      <Badge tone="success" icon={<CheckCircleIcon size={12} />}>
        API readiness confirmed
      </Badge>
    );
  }
  return (
    <Tooltip content="Confirm access, limits and a test environment with the system owner before delivery planning relies on this integration.">
      <span tabIndex={0} className="strategy-readiness-trigger">
        <Badge tone="warning" icon={<AlertTriangleIcon size={12} />}>
          API readiness not confirmed
        </Badge>
      </span>
    </Tooltip>
  );
}

export interface ProcessingTypeBadgeProps {
  type: ProcessingType;
}

interface ProcessingTypeMeta extends BadgeMeta {
  Icon: ComponentType<IconProps>;
}

const PROCESSING_TYPE_META: ReadonlyMap<ProcessingType, ProcessingTypeMeta> = new Map([
  ['ai', { label: 'AI-automated', tone: 'violet', Icon: SparklesIcon }],
  ['deterministic', { label: 'Deterministic rule', tone: 'teal', Icon: CheckCircleIcon }],
  ['human-decision', { label: 'Human decision required', tone: 'primary', Icon: UserIcon }],
]);

const FALLBACK_PROCESSING_META: ProcessingTypeMeta = { label: 'Unclassified', tone: 'neutral', Icon: SparklesIcon };

export function ProcessingTypeBadge({ type }: ProcessingTypeBadgeProps): ReactElement {
  const meta = PROCESSING_TYPE_META.get(type) ?? FALLBACK_PROCESSING_META;
  return (
    <Badge tone={meta.tone} icon={<meta.Icon size={12} />}>
      {meta.label}
    </Badge>
  );
}
