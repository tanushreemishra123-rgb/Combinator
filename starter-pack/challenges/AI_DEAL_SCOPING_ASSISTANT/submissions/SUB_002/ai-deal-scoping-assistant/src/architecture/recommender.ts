/**
 * Transparent, additive cloud platform recommendation. Every point awarded is a documented
 * constant with a reason that cites the scope item (or configuration field) that earned it, so
 * the recommendation can be shown to the user even when they pick the platform manually - the
 * spec asks the assistant to let the user "Select a preferred cloud platform, or Allow the
 * assistant to recommend one based on the requirements".
 */
import type { CloudPlatform, PlatformRecommendation, PlatformScore, ScopeItem, ScopeModel, SolutionConfig } from '../domain';
import { platformLabel } from './catalog/cloudServiceCatalog.data';
import { itemsWithAnySignal } from './scopeQueries';

/** Deterministic evaluation and tie-break order - AWS, then Azure, then GCP. */
export const PLATFORM_ORDER: readonly CloudPlatform[] = ['aws', 'azure', 'gcp'];

/** Points for an explicit `cloud:<platform>` signal - the customer stated the preference directly. */
export const CLOUD_SIGNAL_POINTS = 30;
/** Points per matched vendor/technology keyword in a scope item's title or description. */
export const KEYWORD_MATCH_POINTS = 18;
/** Points from the configured AI provider preference (see SolutionConfig.aiProviderPreference). */
export const AI_PROVIDER_PREFERENCE_POINTS = 15;
/** Slight bias toward GCP when the scope is clearly analytics/BI heavy (BigQuery/Looker strength). */
export const ANALYTICS_HEAVY_BONUS = 10;
/** Slight bias toward Azure when the scope combines SSO and RBAC (Entra ID enterprise directory strength). */
export const ENTERPRISE_IDENTITY_BONUS = 10;
/** Minimum number of analytics-signal items before the analytics-heavy bonus applies. */
const ANALYTICS_HEAVY_MIN_SIGNALS = 2;

interface KeywordRule {
  pattern: RegExp;
  platform: CloudPlatform;
  description: string;
}

/** Vendor/technology mentions that indicate an existing footprint or preference (spec section 3). */
const KEYWORD_RULES: readonly KeywordRule[] = [
  { pattern: /\bmicrosoft\b/i, platform: 'azure', description: 'mentions Microsoft' },
  { pattern: /\bentra\b/i, platform: 'azure', description: 'mentions Microsoft Entra' },
  { pattern: /\.net\b/i, platform: 'azure', description: 'mentions the .NET platform' },
  { pattern: /\bpower\s?bi\b/i, platform: 'azure', description: 'mentions Power BI' },
  { pattern: /\bactive directory\b/i, platform: 'azure', description: 'mentions Active Directory' },
  { pattern: /\bbigquery\b/i, platform: 'gcp', description: 'mentions BigQuery' },
  { pattern: /\blooker\b/i, platform: 'gcp', description: 'mentions Looker' },
  { pattern: /\bgoogle workspace\b/i, platform: 'gcp', description: 'mentions Google Workspace' },
  { pattern: /\bbedrock\b/i, platform: 'aws', description: 'mentions Amazon Bedrock' },
  { pattern: /\bamazon\b/i, platform: 'aws', description: 'mentions Amazon' },
  { pattern: /\baws\b/i, platform: 'aws', description: 'mentions an existing AWS footprint' },
];

type Reason = PlatformScore['reasons'][number];

/** Mutable accumulator kept only inside this module; the public API returns frozen PlatformScore[]. */
class ScoreBoard {
  private readonly reasons = new Map<CloudPlatform, Reason[]>(PLATFORM_ORDER.map((platform) => [platform, []]));
  /** Reasons that apply equally to every platform (e.g. "compliance is supported everywhere") - kept
   *  separate from per-platform reasons so the same sentence is never printed three times over. */
  private readonly neutral: Reason[] = [];

  add(platform: CloudPlatform, points: number, text: string, refs: readonly string[] = []): void {
    this.reasons.get(platform)?.push({ text, refs: [...refs], points });
  }

  /** Records a platform-neutral observation once, instead of duplicating it into every platform's row. */
  addNeutral(text: string, refs: readonly string[] = []): void {
    this.neutral.push({ text, refs: [...refs], points: 0 });
  }

  toScores(): PlatformScore[] {
    return PLATFORM_ORDER.map((platform) => {
      const reasons = this.reasons.get(platform) ?? [];
      return { platform, score: reasons.reduce((total, reason) => total + reason.points, 0), reasons };
    });
  }

  /** Attaches every neutral observation to a single platform's reasons - the recommended one - so it
   *  is shown exactly once across the whole comparison instead of once per platform. */
  attachNeutralTo(scores: readonly PlatformScore[], platform: CloudPlatform): PlatformScore[] {
    if (this.neutral.length === 0) {
      return [...scores];
    }
    return scores.map((score) => (score.platform === platform ? { ...score, reasons: [...score.reasons, ...this.neutral] } : score));
  }
}

/** One vendor/preference signal a single scope item contributed toward a single platform, before
 *  merging - an item may earn both an explicit-preference match and one or more keyword matches for
 *  the same platform, and each keyword pattern matches independently. */
interface ItemSignalMatch {
  itemId: string;
  platform: CloudPlatform;
  points: number;
  /** Lower-case verb phrase, e.g. "states a direct preference for Amazon Web Services (AWS)" or
   *  "mentions Amazon" - combined across a group before it becomes one Reason. */
  fragment: string;
  /** True for the explicit cloud:<platform> match, whose fragment already names the platform, so a
   *  merged sentence never also appends a redundant "indicating an affinity for <platform>" clause. */
  isExplicit: boolean;
}

function explicitCloudSignalMatches(scope: ScopeModel): ItemSignalMatch[] {
  const matches: ItemSignalMatch[] = [];
  for (const platform of PLATFORM_ORDER) {
    for (const item of itemsWithAnySignal(scope, [`cloud:${platform}`])) {
      matches.push({ itemId: item.id, platform, points: CLOUD_SIGNAL_POINTS, fragment: `states a direct preference for ${platformLabel(platform)}`, isExplicit: true });
    }
  }
  return matches;
}

function keywordMatches(scope: ScopeModel): ItemSignalMatch[] {
  const matches: ItemSignalMatch[] = [];
  const candidates: readonly ScopeItem[] = scope.items.filter((item) => item.inScope);
  for (const item of candidates) {
    const text = `${item.title} ${item.description}`;
    for (const rule of KEYWORD_RULES) {
      if (rule.pattern.test(text)) {
        matches.push({ itemId: item.id, platform: rule.platform, points: KEYWORD_MATCH_POINTS, fragment: rule.description, isExplicit: false });
      }
    }
  }
  return matches;
}

/** Joins verb-phrase fragments into one clause ("a", "a and b", "a, b, and c"). */
function joinFragments(fragments: readonly string[]): string {
  if (fragments.length <= 1) {
    return fragments.at(0) ?? '';
  }
  if (fragments.length === 2) {
    return `${fragments[0]} and ${fragments[1]}`;
  }
  return `${fragments.slice(0, -1).join(', ')}, and ${fragments.at(-1)}`;
}

/** One combined reason for every signal match sharing the same item and platform, so an item that
 *  both states a direct cloud preference and matches several vendor keywords is never counted, or
 *  shown, as several separate factors (see ARC-10). The merged reason keeps the highest of the
 *  matches' points rather than summing them. */
function mergeSignalMatches(group: readonly ItemSignalMatch[]): Reason & { platform: CloudPlatform } {
  const first = group[0];
  if (first === undefined) {
    throw new Error('mergeSignalMatches requires at least one match');
  }
  const points = Math.max(...group.map((match) => match.points));
  const clause = joinFragments(group.map((match) => match.fragment));
  const text = group.some((match) => match.isExplicit)
    ? `${first.itemId} ${clause}.`
    : `${first.itemId} ${clause}, indicating an affinity for ${platformLabel(first.platform)}.`;
  return { platform: first.platform, text, points, refs: [first.itemId] };
}

function scoreVendorSignals(board: ScoreBoard, scope: ScopeModel): void {
  const matches = [...explicitCloudSignalMatches(scope), ...keywordMatches(scope)];
  const groups = new Map<string, ItemSignalMatch[]>();
  for (const match of matches) {
    const key = `${match.platform}:${match.itemId}`;
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, [match]);
    } else {
      group.push(match);
    }
  }
  for (const group of groups.values()) {
    const reason = mergeSignalMatches(group);
    board.add(reason.platform, reason.points, reason.text, reason.refs);
  }
}

function scoreAiProviderPreference(board: ScoreBoard, config: SolutionConfig): void {
  if (config.aiProviderPreference === 'openai') {
    board.add('azure', AI_PROVIDER_PREFERENCE_POINTS, 'The configured AI provider preference (OpenAI) is natively available through Azure OpenAI in Azure AI Foundry.');
  } else if (config.aiProviderPreference === 'anthropic') {
    board.add('aws', AI_PROVIDER_PREFERENCE_POINTS, 'The configured AI provider preference (Anthropic) is natively available through Amazon Bedrock (also available via Vertex AI on GCP).');
  } else if (config.aiProviderPreference === 'open-source') {
    board.addNeutral('Open-source model preference is supported equally through each platform’s model marketplace (Bedrock Marketplace, Azure AI Foundry, Vertex AI Model Garden).');
  }
}

function scoreComplianceResidency(board: ScoreBoard, scope: ScopeModel): void {
  const items = itemsWithAnySignal(scope, ['security:data-residency', 'compliance:gdpr', 'compliance:hipaa', 'compliance:pci', 'compliance:soc2', 'compliance:iso27001', 'compliance:sox', 'compliance:fedramp']);
  if (items.length === 0) {
    return;
  }
  const ids = items.map((item) => item.id);
  board.addNeutral(`Compliance/residency needs (${ids.join(', ')}) are supported by regional data centres on all three platforms and do not change the recommendation.`, ids);
}

function scoreAnalyticsHeavy(board: ScoreBoard, scope: ScopeModel): void {
  const items = itemsWithAnySignal(scope, ['data:warehouse', 'data:reporting', 'data:etl']);
  if (items.length < ANALYTICS_HEAVY_MIN_SIGNALS) {
    return;
  }
  const ids = items.map((item) => item.id);
  board.add('gcp', ANALYTICS_HEAVY_BONUS, `The scope is analytics/BI heavy (${ids.join(', ')}), an area where BigQuery and Looker are differentiated.`, ids);
}

function scoreEnterpriseIdentity(board: ScoreBoard, scope: ScopeModel): void {
  const sso = itemsWithAnySignal(scope, ['security:sso']);
  const rbac = itemsWithAnySignal(scope, ['security:rbac']);
  if (sso.length === 0 || rbac.length === 0) {
    return;
  }
  const ids = [...new Set([...sso.map((item) => item.id), ...rbac.map((item) => item.id)])];
  board.add('azure', ENTERPRISE_IDENTITY_BONUS, `Combined SSO and role-based access needs (${ids.join(', ')}) align with Microsoft Entra ID's enterprise directory integration.`, ids);
}

const CLOSING_CAVEAT = 'This is an AI-generated recommendation and should be validated by a solution architect before it is treated as final.';

/** Plain wording for the case no requirement produced any scoring signal at all - never dressed up
 *  as reasoned analysis (spec section 3 finding: a 0-point "recommendation" must say so plainly). */
function buildDefaultExplanation(recommended: CloudPlatform, tiedPlatforms: readonly CloudPlatform[]): string {
  const tieText = tiedPlatforms.length > 1 ? ` ${tiedPlatforms.map(platformLabel).join(', ')} were evaluated identically.` : '';
  return `No functional, non-functional, security or technology signal in the reviewed scope favors one cloud platform over another, so ${platformLabel(recommended)} is proposed as a default pending more information, chosen by the standard evaluation order (AWS, then Azure, then GCP).${tieText} ${CLOSING_CAVEAT}`;
}

function buildExplanation(scores: readonly PlatformScore[], recommended: CloudPlatform, tiedPlatforms: readonly CloudPlatform[]): string {
  const winner = scores.find((score) => score.platform === recommended);
  const topReasons = (winner?.reasons ?? []).filter((reason) => reason.points > 0);
  if (topReasons.length === 0) {
    return buildDefaultExplanation(recommended, tiedPlatforms);
  }
  const tieText =
    tiedPlatforms.length > 1
      ? ` ${tiedPlatforms.map(platformLabel).join(', ')} scored equally (${winner?.score ?? 0} points); ${platformLabel(recommended)} was selected by the standard evaluation order (AWS, then Azure, then GCP).`
      : '';
  return `${platformLabel(recommended)} is recommended based on the reviewed scope and configuration. Key factors: ${topReasons.map((reason) => reason.text).join(' ')}${tieText} ${CLOSING_CAVEAT}`;
}

/** Additive, transparent platform scoring - see the exported *_POINTS/*_BONUS constants for weights. */
export function recommendPlatform(scope: ScopeModel, config: SolutionConfig): PlatformRecommendation {
  const board = new ScoreBoard();
  scoreVendorSignals(board, scope);
  scoreAiProviderPreference(board, config);
  scoreComplianceResidency(board, scope);
  scoreAnalyticsHeavy(board, scope);
  scoreEnterpriseIdentity(board, scope);

  const rawScores = board.toScores();
  const maxScore = Math.max(...rawScores.map((score) => score.score));
  const tiedPlatforms = rawScores.filter((score) => score.score === maxScore).map((score) => score.platform);
  const recommended = PLATFORM_ORDER.find((platform) => tiedPlatforms.includes(platform)) ?? 'aws';
  const scores = board.attachNeutralTo(rawScores, recommended);

  return { recommended, scores, explanation: buildExplanation(scores, recommended, tiedPlatforms) };
}
