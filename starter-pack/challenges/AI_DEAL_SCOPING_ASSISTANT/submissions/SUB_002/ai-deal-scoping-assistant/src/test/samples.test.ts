/**
 * The committed `samples/` folder is real output of this code: every Markdown package (and the
 * ClaimsDesk HTML package) is a Vitest file snapshot of the full mock-mode pipeline, so a change
 * that alters the generated package fails here until the samples are refreshed with
 * `npx vitest run src/test/samples.test.ts -u`.
 */
import { createMockProvider } from '../ai';
import type { ScopingSession } from '../domain';
import { buildPackage, buildPackageDiagrams, toHtml, toMarkdown } from '../export';
import { applyImpactReport, createImpactReport, describeChanges } from '../impact';
import { updateScopeItem } from '../scope';
import { SEED_SCENARIOS } from '../seed';
import { PIPELINE_NOW, runFullPipeline } from './pipelineHarness';

const PACKAGE_OPTIONS = { aiModeLabel: 'Mock AI mode', generatedAt: PIPELINE_NOW };

/** Records the impact of moving `before` to `after`, exactly as the change-impact flow of the app does. */
async function recordChange(before: ScopingSession, after: ScopingSession): Promise<ScopingSession> {
  let session = after;
  for (const change of describeChanges(before, after)) {
    const report = await createImpactReport(session, change, { provider: createMockProvider(), fallback: null, scopeVersion: session.scope?.version ?? 0 }, PIPELINE_NOW);
    session = applyImpactReport(session, report);
  }
  return session;
}

describe('committed sample packages', () => {
  // Every stage stamps its generation time, so the clock is pinned to keep the samples byte-stable.
  beforeAll(() => {
    vi.useFakeTimers({ now: new Date(PIPELINE_NOW), toFake: ['Date'] });
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it.each(SEED_SCENARIOS.map((scenario) => [scenario.id, scenario] as const))('samples/%s.md is the current Markdown export', async (id, scenario) => {
    const session = await runFullPipeline(scenario);
    await expect(toMarkdown(buildPackage(session, PACKAGE_OPTIONS))).toMatchFileSnapshot(`../../samples/${id}.md`);
  });

  it('samples/app-modernization-claims-portal.change-impact.md is the change log after three typical changes', async () => {
    const scenario = SEED_SCENARIOS.find((candidate) => candidate.category === 'application-modernization');
    if (scenario === undefined) {
      throw new Error('the application-modernization seed scenario is missing');
    }
    const generated = await runFullPipeline(scenario);
    const moreUsers = await recordChange(generated, { ...generated, config: { ...generated.config, expectedUsers: 500_000 } });
    const moreContingency = await recordChange(moreUsers, { ...moreUsers, estimationConfig: { ...moreUsers.estimationConfig, contingencyPct: 25 } });
    const scope = moreContingency.scope;
    if (scope === null) {
      throw new Error('expected a reviewed scope');
    }
    const lowerPriority = await recordChange(moreContingency, { ...moreContingency, scope: updateScopeItem(scope, 'FR_05', { priority: 'Low' }) });
    expect(lowerPriority.changeLog).toHaveLength(3);
    const document = buildPackage(lowerPriority, PACKAGE_OPTIONS);
    const changeLogOnly = { ...document, sections: document.sections.filter((section) => section.id === 'change-log') };
    await expect(toMarkdown(changeLogOnly)).toMatchFileSnapshot(`../../samples/${scenario.id}.change-impact.md`);
  });

  it('samples/app-modernization-claims-portal.html is the current HTML export', async () => {
    const scenario = SEED_SCENARIOS.find((candidate) => candidate.category === 'application-modernization');
    if (scenario === undefined) {
      throw new Error('the application-modernization seed scenario is missing');
    }
    const session = await runFullPipeline(scenario);
    const html = toHtml(buildPackage(session, PACKAGE_OPTIONS), buildPackageDiagrams(session));
    await expect(html).toMatchFileSnapshot(`../../samples/${scenario.id}.html`);
  });
});
