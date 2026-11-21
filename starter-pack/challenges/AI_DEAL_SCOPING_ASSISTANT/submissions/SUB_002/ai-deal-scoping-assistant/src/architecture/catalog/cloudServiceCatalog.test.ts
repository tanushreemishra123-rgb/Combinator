import { describe, expect, it } from 'vitest';
import type { CloudPlatform } from '../../domain';
import { ARCHITECTURE_AREAS } from '../../domain';
import { CLOUD_SERVICE_CATALOG, getCatalogEntry, getCatalogService, platformLabel, servicesForPlatform } from './cloudServiceCatalog.data';

const PLATFORMS: readonly CloudPlatform[] = ['aws', 'azure', 'gcp'];

describe('CLOUD_SERVICE_CATALOG', () => {
  it('has a sensible number of logical components', () => {
    expect(CLOUD_SERVICE_CATALOG.length).toBeGreaterThanOrEqual(35);
    expect(CLOUD_SERVICE_CATALOG.length).toBeLessThanOrEqual(42);
  });

  it('gives every entry a non-empty, non-placeholder service for all three platforms', () => {
    for (const entry of CLOUD_SERVICE_CATALOG) {
      for (const platform of PLATFORMS) {
        const service = entry.services.find((candidate) => candidate.platform === platform);
        expect(service, `${entry.logicalComponent} missing ${platform}`).toBeDefined();
        expect(service?.service.trim()).not.toBe('');
        expect(service?.service.toLowerCase()).not.toContain('n/a');
        expect(service?.service.toLowerCase()).not.toBe('tbd');
        expect(service?.notes.trim()).not.toBe('');
      }
    }
  });

  it('has unique logical component ids', () => {
    const ids = CLOUD_SERVICE_CATALOG.map((entry) => entry.logicalComponent);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers every architecture area', () => {
    const coveredAreas = new Set(CLOUD_SERVICE_CATALOG.map((entry) => entry.area));
    for (const area of ARCHITECTURE_AREAS) {
      expect(coveredAreas.has(area), `no catalog entry covers area '${area}'`).toBe(true);
    }
  });

  it('never reuses the same service name across platforms within one entry', () => {
    for (const entry of CLOUD_SERVICE_CATALOG) {
      const names = entry.services.map((service) => service.service);
      expect(new Set(names).size).toBe(names.length);
    }
  });
});

describe('getCatalogEntry / getCatalogService', () => {
  it('resolves a known logical component to its catalog entry', () => {
    const entry = getCatalogEntry('managed-relational-db');
    expect(entry?.label).toBe('Managed Relational Database');
  });

  it('returns undefined for an unknown logical component', () => {
    expect(getCatalogEntry('not-a-real-component')).toBeUndefined();
    expect(getCatalogService('not-a-real-component', 'aws')).toBeUndefined();
  });

  it('returns the platform-specific service, matching the spec example for Azure PostgreSQL', () => {
    expect(getCatalogService('managed-relational-db', 'azure')).toContain('Azure Database for PostgreSQL');
    expect(getCatalogService('managed-relational-db', 'aws')).toContain('RDS');
    expect(getCatalogService('managed-relational-db', 'gcp')).toContain('Cloud SQL');
  });
});

describe('servicesForPlatform', () => {
  it('collects every service the platform offers, one per logical component', () => {
    const awsServices = servicesForPlatform('aws');
    expect(awsServices.size).toBe(CLOUD_SERVICE_CATALOG.length);
    expect(awsServices.has('Amazon RDS for PostgreSQL')).toBe(true);
  });

  it('does not leak another platform service name', () => {
    const awsServices = servicesForPlatform('aws');
    expect(awsServices.has('Azure Database for PostgreSQL - Flexible Server')).toBe(false);
  });
});

describe('platformLabel', () => {
  it('labels every supported platform', () => {
    expect(platformLabel('aws')).toContain('AWS');
    expect(platformLabel('azure')).toContain('Azure');
    expect(platformLabel('gcp')).toContain('Google Cloud');
  });
});
