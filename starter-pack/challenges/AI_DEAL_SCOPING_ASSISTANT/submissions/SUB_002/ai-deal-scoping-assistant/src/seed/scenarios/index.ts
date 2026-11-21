/** Aggregates the four required seed scenarios (one per required category). */
import { aiEnabledScenario } from './aiEnabled';
import { applicationModernizationScenario } from './applicationModernization';
import { dataIntegrationScenario } from './dataIntegration';
import { missingInformationScenario } from './missingInformation';
import type { SeedScenario } from '..';

export { applicationModernizationScenario } from './applicationModernization';
export { dataIntegrationScenario } from './dataIntegration';
export { aiEnabledScenario } from './aiEnabled';
export { missingInformationScenario } from './missingInformation';

export const SCENARIOS: readonly SeedScenario[] = [
  applicationModernizationScenario,
  dataIntegrationScenario,
  aiEnabledScenario,
  missingInformationScenario,
];
