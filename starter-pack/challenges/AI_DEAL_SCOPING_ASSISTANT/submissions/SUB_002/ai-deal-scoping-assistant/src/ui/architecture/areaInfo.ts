/**
 * Presentational display names for the 14 architecture areas the spec names (Functional
 * Requirements 3, "Cloud Solution Architecture": "The architecture output should cover applicable
 * areas such as..."), in the same order the spec lists them, so the components tab can list every
 * area - including ones with zero proposed components - and make gaps visible at a glance.
 */
import type { ArchitectureArea } from '../../domain';
import { ARCHITECTURE_AREAS } from '../../domain';

const AREA_LABELS: ReadonlyMap<ArchitectureArea, string> = new Map([
  ['user-apps', 'User-facing applications'],
  ['backend', 'Backend services'],
  ['api', 'APIs'],
  ['data-storage', 'Databases and storage'],
  ['identity', 'Identity and access management'],
  ['messaging', 'Messaging and event processing'],
  ['integration', 'Integration components'],
  ['ai-ml', 'AI and machine-learning services'],
  ['observability', 'Observability and monitoring'],
  ['security', 'Security controls'],
  ['deployment', 'Deployment and runtime approach'],
  ['environments', 'Development, test, and production environments'],
  ['availability', 'Availability and scalability'],
  ['backup-dr', 'Backup and disaster recovery'],
]);

export function areaLabel(area: ArchitectureArea): string {
  return AREA_LABELS.get(area) ?? area;
}

export interface AreaCount {
  area: ArchitectureArea;
  label: string;
  count: number;
}

/** Every architecture area in spec order with how many of the design's components fall into it. */
export function countComponentsByArea(components: readonly { area: ArchitectureArea }[]): AreaCount[] {
  return ARCHITECTURE_AREAS.map((area) => ({
    area,
    label: areaLabel(area),
    count: components.filter((component) => component.area === area).length,
  }));
}
