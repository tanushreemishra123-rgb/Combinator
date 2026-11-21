/**
 * "Solution architecture" package section (spec 6): platform + selection mode + recommendation
 * scores, the component table, environments, deployment, availability, backup/DR and security controls.
 */
import type { ArchitectureComponent, ArchitectureDesign, EnvironmentPlan, PackageSection, PlatformScore, ScopingSession, TracedStatement } from '../../domain';
import { headingBlock, joinOrFallback, joinSentences, notGeneratedCallout, platformDisplayName, provenanceBlock, refsCell, statementLine, tableOrParagraph } from '../text';

const COMPONENT_COLUMNS = ['Component', 'Service', 'Requirements / assumptions', 'Purpose', 'Rationale', 'Trade-offs', 'Dependencies', 'Security considerations'] as const;

function componentRow(component: ArchitectureComponent): string[] {
  return [
    component.name,
    component.service,
    refsCell([...component.requirementIds, ...component.assumptionIds]),
    component.purpose,
    component.rationale,
    joinSentences(component.tradeOffs, 'None noted'),
    joinOrFallback(component.dependencies, 'None'),
    joinSentences(component.securityConsiderations, 'None noted'),
  ];
}

function scoreRow(score: PlatformScore): string[] {
  const reasons = score.reasons.map((reason) => `${reason.points >= 0 ? '+' : ''}${reason.points} ${reason.text} (${refsCell(reason.refs)})`);
  return [platformDisplayName(score.platform), String(score.score), joinSentences(reasons, 'No scoring signals found.')];
}

function environmentRow(environment: EnvironmentPlan): string[] {
  return [environment.name, environment.purpose, environment.sizing.trim().length > 0 ? environment.sizing : 'Not yet sized'];
}

function statementBlocks(statements: readonly TracedStatement[], emptyMessage: string) {
  return statements.length === 0 ? [{ type: 'paragraph' as const, text: emptyMessage }] : statements.map((statement) => ({ type: 'paragraph' as const, text: statementLine(statement) }));
}

function selectionText(design: ArchitectureDesign): string {
  return design.selection === 'ai-recommended' ? 'AI-recommended (accepted as proposed)' : 'User-selected';
}

export function buildSolutionArchitectureSection(session: ScopingSession): PackageSection {
  const design = session.outputs.architecture.data;
  if (design === null) {
    return { id: 'solution-architecture', title: 'Solution architecture', blocks: [notGeneratedCallout('the solution architecture has not been generated yet')] };
  }
  const provenance = provenanceBlock(session.outputs.architecture.meta);
  return {
    id: 'solution-architecture',
    title: 'Solution architecture',
    blocks: [
      ...(provenance === null ? [] : [provenance]),
      { type: 'keyValues', pairs: [{ key: 'Cloud platform', value: platformDisplayName(design.platform) }, { key: 'Selection', value: selectionText(design) }] },
      ...statementBlocks(design.summary, 'No architecture summary was generated.'),
      headingBlock(3, 'Platform recommendation scores'),
      tableOrParagraph(['Platform', 'Score', 'Reasons'], design.recommendation.scores.map(scoreRow), 'No platform scoring was recorded.'),
      { type: 'paragraph', text: design.recommendation.explanation },
      headingBlock(3, 'Architecture components'),
      tableOrParagraph([...COMPONENT_COLUMNS], design.components.map(componentRow), 'No architecture components were generated.'),
      headingBlock(3, 'Environments'),
      tableOrParagraph(['Environment', 'Purpose', 'Sizing'], design.environments.map(environmentRow), 'No environment plan was generated.'),
      headingBlock(3, 'Deployment'),
      ...statementBlocks(design.deployment, 'No deployment approach was generated.'),
      headingBlock(3, 'Availability'),
      ...statementBlocks(design.availability, 'No availability approach was generated.'),
      headingBlock(3, 'Backup and disaster recovery'),
      ...statementBlocks(design.backupDr, 'No backup or disaster-recovery approach was generated.'),
      headingBlock(3, 'Security controls'),
      ...statementBlocks(design.securityControls, 'No security controls were generated.'),
    ],
  };
}
