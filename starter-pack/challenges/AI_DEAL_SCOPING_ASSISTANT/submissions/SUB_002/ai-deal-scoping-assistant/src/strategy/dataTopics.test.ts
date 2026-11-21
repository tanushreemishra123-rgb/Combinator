import type { ArchitectureComponent, ScopeItem } from '../domain';
import { fixtureScope } from '../test/fixtures';
import { buildDataTopics } from './dataTopics';
import { fixtureArchitectureDesign } from './testFixtures';

/** A minimal, valid ArchitectureComponent so a test can build a small components array without every unrelated field the domain type requires. */
function minimalComponent(partial: Pick<ArchitectureComponent, 'id' | 'name' | 'area' | 'logicalComponent' | 'service'>): ArchitectureComponent {
  return {
    ...partial,
    requirementIds: [],
    assumptionIds: [],
    purpose: `${partial.name} implements the ${partial.area} area.`,
    rationale: `${partial.service} is the selected service.`,
    tradeOffs: [],
    dependencies: [],
    securityConsiderations: [],
  };
}

/** Clones a real fixture data item so every ScopeItem field is populated, then overrides what the test cares about. */
function dataItem(overrides: Partial<ScopeItem>): ScopeItem {
  const base = fixtureScope().items.find((item) => item.id === 'DATA_01');
  if (base === undefined) {
    throw new Error('fixture scope no longer contains DATA_01');
  }
  return { ...base, ...overrides };
}

function gapItem(overrides: Partial<ScopeItem>): ScopeItem {
  const base = fixtureScope().items.find((item) => item.id === 'GAP_01');
  if (base === undefined) {
    throw new Error('fixture scope no longer contains GAP_01');
  }
  return { ...base, ...overrides };
}

/** Clones a real fixture non-functional item, so a topic whose keywords match no reviewed `data` item can still be given a customer-stated requirement as evidence. */
function nonFunctionalItem(overrides: Partial<ScopeItem>): ScopeItem {
  const base = fixtureScope().items.find((item) => item.id === 'NFR_01');
  if (base === undefined) {
    throw new Error('fixture scope no longer contains NFR_01');
  }
  return { ...base, ...overrides };
}

const design = fixtureArchitectureDesign();

describe('buildDataTopics per-topic domain relevance', () => {
  it('cites only the domain that carries a retention signal, not every reviewed domain', () => {
    const member = dataItem({ id: 'DATA_01', title: 'Member records', description: 'Member profile records.', signals: ['data:pii'] });
    const retained = dataItem({ id: 'DATA_02', title: 'Six-year audit log', description: 'Audit log retained six years.', signals: ['data:retention'] });
    const topics = buildDataTopics([member, retained], design.components, design.platform, ['Member records', 'Six-year audit log'], 'Northwind Mutual');
    const retention = topics.find((topic) => topic.topic === 'retention');
    expect(retention?.approach).toContain('Six-year audit log');
    expect(retention?.approach).not.toContain('Member records');
  });

  it('cites only the domain that carries a privacy-relevant signal, and names the compliance requirement id', () => {
    const member = dataItem({ id: 'DATA_01', title: 'Member records', description: 'Member profile records.', signals: ['data:pii'] });
    const retained = dataItem({ id: 'DATA_02', title: 'Six-year audit log', description: 'Audit log retained six years.', signals: ['data:retention'] });
    const gdprItem = gapItem({ id: 'SEC_09', kind: 'security', title: 'GDPR scope', description: 'GDPR applies.', signals: ['compliance:gdpr'], provenance: 'customer-stated' });
    const topics = buildDataTopics([member, retained, gdprItem], design.components, design.platform, ['Member records', 'Six-year audit log'], 'Northwind Mutual');
    const privacy = topics.find((topic) => topic.topic === 'privacy-security');
    expect(privacy?.approach).toContain('Member records');
    expect(privacy?.approach).not.toContain('Six-year audit log');
    expect(privacy?.approach).toContain('GDPR');
    expect(privacy?.approach).toContain('SEC_09');
  });

  it('names the open gap instead of reciting the full domain list when nothing in scope matches a topic', () => {
    const member = dataItem({ id: 'DATA_01', title: 'Member records', description: 'Member profile records.', signals: ['data:pii'] });
    const retentionGap = gapItem({ id: 'GAP_05', title: 'Retention period unconfirmed', description: 'How long records are kept is unconfirmed.', signals: ['data:retention'] });
    const topics = buildDataTopics([member, retentionGap], design.components, design.platform, ['Member records'], 'Northwind Mutual');
    const retention = topics.find((topic) => topic.topic === 'retention');
    expect(retention?.approach).toContain('GAP_05');
    expect(retention?.approach).not.toContain('Member records');
  });

  it('states a neutral fallback, never the unrelated full domain list, when nothing matches and no gap or question tracks it', () => {
    const member = dataItem({ id: 'DATA_01', title: 'Member records', description: 'Member profile records.', signals: ['data:pii'] });
    const topics = buildDataTopics([member], design.components, design.platform, ['Member records'], 'Northwind Mutual');
    const retention = topics.find((topic) => topic.topic === 'retention');
    expect(retention?.approach).not.toContain('Member records');
    expect(retention?.approach.length).toBeGreaterThan(0);
  });

  it('lets the two domain-agnostic topics (ownership, transactional storage) cite every reviewed domain', () => {
    const member = dataItem({ id: 'DATA_01', title: 'Member records', description: 'Member profile records.', signals: ['data:pii'] });
    const retained = dataItem({ id: 'DATA_02', title: 'Six-year audit log', description: 'Audit log retained six years.', signals: ['data:retention'] });
    const topics = buildDataTopics([member, retained], design.components, design.platform, ['Member records', 'Six-year audit log'], 'Northwind Mutual');
    const ownership = topics.find((topic) => topic.topic === 'ownership');
    const transactional = topics.find((topic) => topic.topic === 'transactional-storage');
    expect(ownership?.approach).toContain('Member records');
    expect(ownership?.approach).toContain('Six-year audit log');
    expect(transactional?.approach).toContain('Member records');
    expect(transactional?.approach).toContain('Six-year audit log');
  });

  it('never gives two topics the exact same opening sentence', () => {
    const member = dataItem({ id: 'DATA_01', title: 'Member records', description: 'Member profile records.', signals: ['data:pii'] });
    const retained = dataItem({ id: 'DATA_02', title: 'Six-year audit log', description: 'Audit log retained six years.', signals: ['data:retention'] });
    const topics = buildDataTopics([member, retained], design.components, design.platform, ['Member records', 'Six-year audit log'], 'Northwind Mutual');
    const approaches = topics.map((topic) => topic.approach);
    expect(new Set(approaches).size).toBe(approaches.length);
  });

  it('agrees the ingestion verb with a single matched domain ("enters")', () => {
    const batchFeed = dataItem({ id: 'DATA_01', title: 'Claims batch feed', description: 'Nightly batch of claims records.', signals: ['data:batch'] });
    const topics = buildDataTopics([batchFeed], design.components, design.platform, ['Claims batch feed'], 'Northwind Mutual');
    const ingestion = topics.find((topic) => topic.topic === 'ingestion');
    expect(ingestion?.approach).toContain('Claims batch feed enters the platform');
  });

  it('agrees the ingestion verb with several matched domains ("enter"), never the singular form', () => {
    const batchFeed = dataItem({ id: 'DATA_01', title: 'Claims batch feed', description: 'Nightly batch of claims records.', signals: ['data:batch'] });
    const fileFeed = dataItem({ id: 'DATA_02', title: 'Scanned attachment files', description: 'Scanned attachments delivered by file drop.', signals: ['data:file'] });
    const topics = buildDataTopics([batchFeed, fileFeed], design.components, design.platform, ['Claims batch feed', 'Scanned attachment files'], 'Northwind Mutual');
    const ingestion = topics.find((topic) => topic.topic === 'ingestion');
    expect(ingestion?.approach).toContain('Claims batch feed and Scanned attachment files enter the platform');
    expect(ingestion?.approach).not.toContain('enters the platform');
  });

  it('never crashes on an empty scope and still returns every topic', () => {
    const topics = buildDataTopics([], design.components, design.platform, ['Application Data'], 'Northwind Mutual');
    expect(topics).toHaveLength(10);
    for (const topic of topics) {
      expect(topic.approach.length).toBeGreaterThan(0);
    }
  });
});

describe('buildDataTopics grounded fallback when a non-data requirement already answers the topic', () => {
  it('cites the availability requirement instead of denying one exists when no data domain matches backup and recovery', () => {
    const availability = nonFunctionalItem({ id: 'NFR_01', title: '99.9% availability', description: 'Portal is available 99.9% of the time.', signals: ['nfr:availability'] });
    const topics = buildDataTopics([availability], design.components, design.platform, [], 'Northwind Mutual');
    const backup = topics.find((topic) => topic.topic === 'backup-recovery');
    expect(backup?.approach).toContain('NFR_01');
    expect(backup?.approach).toContain('99.9% availability');
    expect(backup?.approach).not.toContain('no reviewed requirement');
  });

  it('still denies the fact when no data item, gap or matching requirement covers the topic', () => {
    const member = dataItem({ id: 'DATA_01', title: 'Member records', description: 'Member profile records.', signals: ['data:pii'] });
    const topics = buildDataTopics([member], design.components, design.platform, ['Member records'], 'Northwind Mutual');
    const backup = topics.find((topic) => topic.topic === 'backup-recovery');
    expect(backup?.approach).toContain('no reviewed requirement');
  });

  it('still names the open gap, not the requirement citation, when only a gap tracks the topic', () => {
    const availabilityGap = gapItem({ id: 'GAP_05', title: 'Recovery objective unconfirmed', description: 'The recovery objective has not been confirmed.', signals: ['nfr:availability'] });
    const topics = buildDataTopics([availabilityGap], design.components, design.platform, [], 'Northwind Mutual');
    const backup = topics.find((topic) => topic.topic === 'backup-recovery');
    expect(backup?.approach).toContain('GAP_05');
  });
});

describe('buildDataTopics never names an unrelated service for a topic that needs a dedicated one', () => {
  const member = dataItem({ id: 'DATA_01', title: 'Member records', description: 'Member profile records.', signals: ['data:pii'] });
  const warehouseNeed = dataItem({ id: 'DATA_02', title: 'Reporting extract', description: 'Data warehoused for board reporting.', signals: ['data:warehouse'] });

  it('says no dedicated analytical store is selected yet, instead of naming the transactional database or a cache, when no warehouse/lake component exists', () => {
    const components: ArchitectureComponent[] = [
      minimalComponent({ id: 'ARC_01', name: 'Member Transactional Store', area: 'data-storage', logicalComponent: 'relational-db', service: 'Azure SQL Database' }),
      minimalComponent({ id: 'ARC_02', name: 'Session Cache', area: 'data-storage', logicalComponent: 'cache', service: 'Azure Cache for Redis' }),
    ];
    const topics = buildDataTopics([warehouseNeed], components, 'azure', ['Reporting extract'], 'Northwind Mutual');
    const analytical = topics.find((topic) => topic.topic === 'analytical-storage');
    expect(analytical?.services).toEqual([]);
    expect(analytical?.approach).toContain('no dedicated service is selected');
    expect(analytical?.approach).not.toContain('Azure Cache for Redis');
    expect(analytical?.approach).not.toContain('Azure SQL Database');
  });

  it('excludes a BI tool, ETL pipeline and cache from the transactional-storage service list', () => {
    const components: ArchitectureComponent[] = [
      minimalComponent({ id: 'ARC_01', name: 'Member Transactional Store', area: 'data-storage', logicalComponent: 'relational-db', service: 'Azure SQL Database' }),
      minimalComponent({ id: 'ARC_02', name: 'Session Cache', area: 'data-storage', logicalComponent: 'cache', service: 'Azure Cache for Redis' }),
      minimalComponent({ id: 'ARC_03', name: 'BI Dashboard Tool', area: 'data-storage', logicalComponent: 'bi-tool', service: 'Power BI' }),
    ];
    const topics = buildDataTopics([member], components, 'azure', ['Member records'], 'Northwind Mutual');
    const transactional = topics.find((topic) => topic.topic === 'transactional-storage');
    expect(transactional?.services).toEqual(['Azure SQL Database']);
  });

  it('excludes a cache from the retention topic\'s persistent-store service list', () => {
    const components: ArchitectureComponent[] = [
      minimalComponent({ id: 'ARC_01', name: 'Member Transactional Store', area: 'data-storage', logicalComponent: 'relational-db', service: 'Azure SQL Database' }),
      minimalComponent({ id: 'ARC_02', name: 'Session Cache', area: 'data-storage', logicalComponent: 'cache', service: 'Azure Cache for Redis' }),
    ];
    const topics = buildDataTopics([member], components, 'azure', ['Member records'], 'Northwind Mutual');
    const retention = topics.find((topic) => topic.topic === 'retention');
    expect(retention?.services).toEqual(['Azure SQL Database']);
  });

  it('excludes a notification service from the ingestion topic\'s service list', () => {
    const components: ArchitectureComponent[] = [
      minimalComponent({ id: 'ARC_01', name: 'Integration Platform', area: 'integration', logicalComponent: 'integration-platform', service: 'Azure Logic Apps' }),
      minimalComponent({ id: 'ARC_02', name: 'Notification Service', area: 'integration', logicalComponent: 'notification', service: 'Azure Communication Services' }),
    ];
    const topics = buildDataTopics([member], components, 'azure', ['Member records'], 'Northwind Mutual');
    const ingestion = topics.find((topic) => topic.topic === 'ingestion');
    expect(ingestion?.services).toEqual(['Azure Logic Apps']);
  });
});
