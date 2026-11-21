/** Two-to-three sentence analysis summary: who the customer is, what was found and what is still open. */
import { joinList, prefixForKind } from '../domain';
import type { CustomerContext, ScopeItemDraft, ScopeItemKind } from '../domain';

const MAX_THEMES = 4;

interface CountedKind {
  kind: ScopeItemKind;
  singular: string;
  plural: string;
}

/** Kinds worth naming in the headline count, in reading order. */
const HEADLINE_KINDS: readonly CountedKind[] = [
  { kind: 'business', singular: 'business objective', plural: 'business objectives' },
  { kind: 'functional', singular: 'functional requirement', plural: 'functional requirements' },
  { kind: 'nonFunctional', singular: 'non-functional requirement', plural: 'non-functional requirements' },
  { kind: 'integration', singular: 'integration', plural: 'integrations' },
  { kind: 'data', singular: 'data requirement', plural: 'data requirements' },
  { kind: 'security', singular: 'security and compliance expectation', plural: 'security and compliance expectations' },
];

function countKind(items: readonly ScopeItemDraft[], kind: ScopeItemKind): number {
  return items.filter((item) => item.kind === kind).length;
}

function describeCounts(items: readonly ScopeItemDraft[]): string {
  const parts = HEADLINE_KINDS.map((entry) => ({ entry, count: countKind(items, entry.kind) }))
    .filter(({ count }) => count > 0)
    .map(({ entry, count }) => `${count} ${count === 1 ? entry.singular : entry.plural} (${prefixForKind(entry.kind)})`);
  return parts.length === 0 ? 'no classifiable requirements' : joinList(parts);
}

function describeCustomer(customer: CustomerContext): string {
  const name = customer.customerName.trim() === '' ? 'The customer' : customer.customerName.trim();
  const opportunity = customer.opportunityName.trim();
  return opportunity === '' ? name : `${name} (${opportunity})`;
}

function describeOpenPoints(items: readonly ScopeItemDraft[]): string {
  const gaps = countKind(items, 'gap');
  const questions = countKind(items, 'question');
  const assumptions = countKind(items, 'assumption');
  const critical = items.filter((item) => item.kind === 'gap' && item.critical).length;
  if (gaps + questions + assumptions === 0) {
    return 'No information gaps were detected; the scope can be reviewed and approved as extracted.';
  }
  return `${gaps} information ${gaps === 1 ? 'gap' : 'gaps'} (${critical} critical to estimation), ${questions} clarification ${questions === 1 ? 'question' : 'questions'} and ${assumptions} working ${assumptions === 1 ? 'assumption' : 'assumptions'} need customer validation before the estimate is baselined.`;
}

export interface SummaryInput {
  customer: CustomerContext;
  items: readonly ScopeItemDraft[];
  statementCount: number;
  themes: readonly string[];
}

export function buildAnalysisSummary(input: SummaryInput): string {
  const { customer, items, statementCount, themes } = input;
  const statements = `${statementCount} source ${statementCount === 1 ? 'statement' : 'statements'}`;
  const headline = `${describeCustomer(customer)}: analysis of ${statements} identified ${describeCounts(items)}.`;
  const themeList = themes.slice(0, MAX_THEMES);
  const themeSentence = themeList.length === 0 ? '' : ` Main themes: ${themeList.join('; ')}.`;
  return `${headline}${themeSentence} ${describeOpenPoints(items)}`;
}
