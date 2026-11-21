/** Change-impact analysis structures. */

export const OUTPUT_SECTION_IDS = [
  'prd',
  'functionalScope',
  'architecture',
  'dataIntegration',
  'aiStrategy',
  'estimate',
  'commercials',
] as const;
export type OutputSectionId = (typeof OUTPUT_SECTION_IDS)[number];

export type ChangeKind =
  | 'cloud-platform'
  | 'expected-users'
  | 'delivery-deadline'
  | 'environments'
  | 'target-regions'
  | 'ai-provider-preference'
  | 'requirement-priority'
  | 'requirement-text'
  | 'scope-inclusion'
  | 'security-requirement'
  | 'integration-complexity'
  | 'assumption'
  | 'question-resolved'
  | 'rate-card'
  | 'contingency'
  | 'currency'
  | 'productivity'
  | 'driver-complexity';

export interface ChangeDescriptor {
  kind: ChangeKind;
  /** Scope item / driver / config field that changed. */
  targetId: string;
  label: string;
  from: string;
  to: string;
}

export interface ImpactEntry {
  section: OutputSectionId;
  /** Human-readable area, e.g. 'Scalability architecture' or 'ROM commercials'. */
  area: string;
  elementIds: string[];
  reason: string;
  /** regenerate = AI stage re-runs; recalculate = deterministic engine re-runs. */
  action: 'regenerate' | 'recalculate';
}

export interface UnaffectedEntry {
  section: OutputSectionId | 'scope';
  area: string;
  reason: string;
}

export interface ImpactReport {
  id: string;
  change: ChangeDescriptor;
  affected: ImpactEntry[];
  unaffected: UnaffectedEntry[];
  /** AI-written (or mock) plain-language explanation; the affected list itself is rule-based. */
  explanation: string;
  createdAt: string;
  /** Sections already brought up to date after this change. */
  resolvedSections: OutputSectionId[];
}
