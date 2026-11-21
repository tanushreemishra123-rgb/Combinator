/**
 * Generation prerequisites (spec section 1: "Users must be able to review the analyzed scope before
 * generating downstream deliverables"): every stage needs the approved scope model, and each later
 * stage needs the deliverables it is grounded in. One data table drives the message for every stage.
 */
import type { ScopingSession } from '../domain';
import { stageState } from '../impact';
import { isScopeApproved } from '../scope';
import type { StageId } from './types';

/** Shown for every stage until the reviewed scope model exists and its current version is approved. */
export const APPROVAL_PREREQUISITE = 'Approve the requirements before generating deliverables.';

interface UpstreamNeed {
  stageId: StageId;
  /** How the missing deliverable is named inside the prerequisite sentence. */
  noun: string;
}

const NEEDS_PRD: UpstreamNeed = { stageId: 'prd', noun: 'the PRD' };
const NEEDS_ARCHITECTURE: UpstreamNeed = { stageId: 'architecture', noun: 'the solution architecture' };
const NEEDS_DATA_INTEGRATION: UpstreamNeed = { stageId: 'dataIntegration', noun: 'the data and integration strategy' };
const NEEDS_AI_STRATEGY: UpstreamNeed = { stageId: 'aiStrategy', noun: 'the AI solution approach' };

/** Dependency order of the generation pipeline: each stage reads the deliverables listed here. */
const UPSTREAM_NEEDS: ReadonlyMap<StageId, { goal: string; needs: readonly UpstreamNeed[] }> = new Map([
  ['prd', { goal: 'generating the PRD', needs: [] }],
  ['architecture', { goal: 'designing the solution', needs: [NEEDS_PRD] }],
  ['dataIntegration', { goal: 'planning the data flow', needs: [NEEDS_ARCHITECTURE] }],
  ['aiStrategy', { goal: 'selecting the AI approach', needs: [NEEDS_ARCHITECTURE] }],
  ['estimate', { goal: 'estimating the delivery', needs: [NEEDS_PRD, NEEDS_ARCHITECTURE, NEEDS_DATA_INTEGRATION, NEEDS_AI_STRATEGY] }],
]);

function joinNouns(nouns: readonly string[]): string {
  const last = nouns.at(-1) ?? '';
  return nouns.length <= 1 ? last : `${nouns.slice(0, -1).join(', ')} and ${last}`;
}

/** Message explaining what must happen before the stage can be generated, or null when it is ready. */
export function stagePrerequisite(session: ScopingSession, stageId: StageId): string | null {
  if (!isScopeApproved(session.scope)) {
    return APPROVAL_PREREQUISITE;
  }
  const rule = UPSTREAM_NEEDS.get(stageId);
  const missing = (rule?.needs ?? []).filter((need) => stageState(session.outputs, need.stageId).data === null);
  if (rule === undefined || missing.length === 0) {
    return null;
  }
  return `Generate ${joinNouns(missing.map((need) => need.noun))} before ${rule.goal}.`;
}
