/**
 * Turns the planned component list into the narrative TracedStatement arrays the architecture
 * output carries (summary, deployment, availability, backupDr, securityControls). Every statement
 * is built from a component that already exists in the plan, so its `refs` are always a subset of
 * that component's own citations - nothing here fabricates a new justification.
 */
import type { ArchitectureComponent, Capability, CloudPlatform, ContentLabel, EnvironmentPlan, TracedStatement } from '../domain';
import { platformLabel } from './catalog/cloudServiceCatalog.data';

function citationsFor(component: ArchitectureComponent): string[] {
  return [...component.requirementIds, ...component.assumptionIds];
}

/** Assumption-only citations are surfaced with the 'assumption-to-confirm' label for visibility. */
function labelFor(component: ArchitectureComponent): ContentLabel {
  return component.requirementIds.length === 0 && component.assumptionIds.length > 0 ? 'assumption-to-confirm' : 'ai-interpretation';
}

function statementFrom(component: ArchitectureComponent, text: string): TracedStatement {
  return { text, refs: citationsFor(component), label: labelFor(component) };
}

/** A conditional component that was left out because its only trigger was an unresolved gap or
 *  question (justification.ts gapOnlyTrigger) - surfaced in the summary instead of silently dropped. */
export interface PendingGapNote {
  componentName: string;
  gapId: string;
  gapTitle: string;
}

/** Opening-paragraph reference cap (spec section 3 finding: a wall of 10+ ids reads as unreviewed
 *  machine output); once more citations exist than this, the rest are described qualitatively. */
const SUMMARY_CITATION_CAP = 6;

function pendingGapStatement(note: PendingGapNote): TracedStatement {
  return {
    text: `${note.componentName} is not proposed yet because ${note.gapId} (${note.gapTitle}) is unresolved; add it once that gap is closed.`,
    refs: [note.gapId],
    label: 'assumption-to-confirm',
  };
}

export function buildSummary(
  platform: CloudPlatform,
  components: readonly ArchitectureComponent[],
  capabilities: readonly Capability[],
  pendingGaps: readonly PendingGapNote[] = [],
): TracedStatement[] {
  const allRefs = [...new Set(components.flatMap(citationsFor))];
  const scopeText = capabilities.length > 0 ? `${capabilities.length} functional capabilities` : `${components.length} architecture components`;
  const qualitativeNote =
    allRefs.length > SUMMARY_CITATION_CAP
      ? ' It spans the full reviewed scope; see each component’s own rationale below for its specific citations.'
      : '';
  const headline: TracedStatement = {
    text: `The proposed solution architecture targets ${platformLabel(platform)} and is composed of ${components.length} components covering ${scopeText}.${qualitativeNote}`,
    refs: allRefs.slice(0, SUMMARY_CITATION_CAP),
    label: 'ai-interpretation',
  };
  return [headline, ...pendingGaps.map(pendingGapStatement)];
}

export function buildDeploymentStatements(componentsByKey: ReadonlyMap<string, ArchitectureComponent>, environments: readonly EnvironmentPlan[]): TracedStatement[] {
  const statements: TracedStatement[] = [];
  const ciCd = componentsByKey.get('ci-cd');
  const iac = componentsByKey.get('infrastructure-as-code');
  if (ciCd !== undefined && iac !== undefined) {
    const refs = [...new Set([...citationsFor(ciCd), ...citationsFor(iac)])];
    const environmentNames = environments.map((environment) => environment.name).join(', ');
    statements.push({
      text: `Releases build and deploy through ${ciCd.service}, with every environment (${environmentNames}) provisioned declaratively via ${iac.service} so drift is detected rather than accumulating.`,
      refs,
      label: 'ai-interpretation',
    });
  }
  const runtime = componentsByKey.get('compute-runtime');
  if (runtime !== undefined) {
    statements.push(statementFrom(runtime, `Application services run as containers on ${runtime.service}, promoted unchanged from test into production.`));
  }
  return statements;
}

export function buildAvailabilityStatements(componentsByKey: ReadonlyMap<string, ArchitectureComponent>): TracedStatement[] {
  const statements: TracedStatement[] = [];
  const scaling = componentsByKey.get('availability-scaling');
  const runtime = componentsByKey.get('compute-runtime');
  if (scaling !== undefined) {
    statements.push(statementFrom(scaling, `${scaling.service} distributes traffic and scales the application tier across multiple availability zones to meet the required uptime.`));
  } else if (runtime !== undefined) {
    statements.push({
      text: `${runtime.service} runs in a single region with the platform's default zone redundancy; a multi-region design is deferred until an explicit availability target is confirmed with the customer.`,
      refs: citationsFor(runtime),
      label: 'assumption-to-confirm',
    });
  }
  const cache = componentsByKey.get('cache');
  if (cache !== undefined) {
    statements.push(statementFrom(cache, `${cache.service} absorbs read load at peak concurrency, reducing pressure on the primary database.`));
  }
  return statements;
}

export function buildBackupDrStatements(componentsByKey: ReadonlyMap<string, ArchitectureComponent>): TracedStatement[] {
  const statements: TracedStatement[] = [];
  const backup = componentsByKey.get('backup');
  if (backup !== undefined) {
    statements.push(statementFrom(backup, `${backup.service} takes policy-driven, encrypted backups of the primary data store with periodic restore testing.`));
  }
  const dr = componentsByKey.get('dr-multi-region');
  if (dr !== undefined) {
    statements.push(statementFrom(dr, `${dr.service} provides a cross-region recovery path with a defined recovery time and recovery point objective.`));
  }
  return statements;
}

const SECURITY_CONTROL_TEXT: ReadonlyMap<string, (service: string, isInternalOnly: boolean) => string> = new Map([
  [
    'identity',
    (service, isInternalOnly) =>
      isInternalOnly
        ? `${service} enforces authentication, session management and multi-factor authentication for every internal staff session.`
        : `${service} enforces authentication, session management and multi-factor authentication for every end-user session.`,
  ],
  ['secrets-manager', (service) => `${service} centralizes credential storage and rotation so no service embeds a static secret.`],
  ['key-management', (service) => `${service} manages encryption keys and rotation for data at rest across storage and database services.`],
  ['network-protection', (service) => `${service} isolates backend services on a private network with default-deny inbound access.`],
  ['waf-ddos', (service) => `${service} filters malicious inbound traffic and mitigates volumetric attacks at the edge, in front of the public entry point.`],
]);

export function buildSecurityStatements(componentsByKey: ReadonlyMap<string, ArchitectureComponent>, isInternalOnly: boolean): TracedStatement[] {
  const statements: TracedStatement[] = [];
  for (const [key, describe] of SECURITY_CONTROL_TEXT) {
    const component = componentsByKey.get(key);
    if (component !== undefined) {
      statements.push(statementFrom(component, describe(component.service, isInternalOnly)));
    }
  }
  return statements;
}
