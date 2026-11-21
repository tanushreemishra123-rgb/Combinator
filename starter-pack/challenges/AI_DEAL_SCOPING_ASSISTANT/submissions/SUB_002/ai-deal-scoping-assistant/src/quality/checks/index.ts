/** The quality gate's checks, in the order of the specification's pre-export checklist. */
import type { QualityCheckSpec } from '../types';
import { aiUseCaseSafeguardsCheck } from './aiUseCaseSafeguards';
import { assumptionsNeedingValidationCheck } from './assumptionsNeedingValidation';
import { conflictingCloudSelectionCheck } from './conflictingCloudSelection';
import { estimateConsistencyCheck } from './estimateConsistency';
import { highPriorityCoverageCheck } from './highPriorityCoverage';
import { integrationsMissingFromPlanCheck } from './integrationsMissingFromPlan';
import { missingEstimationInputsCheck } from './missingEstimationInputs';
import { staleSectionsCheck } from './staleSections';
import { uncoveredRequirementsCheck } from './uncoveredRequirements';
import { unjustifiedComponentsCheck } from './unjustifiedComponents';
import { unresolvedQuestionsCheck } from './unresolvedQuestions';
import { unsupportedAdditionsCheck } from './unsupportedAdditions';

/** Same order as QUALITY_CHECK_IDS in src/domain/quality.ts (asserted by the test suite). */
export const QUALITY_CHECKS: readonly QualityCheckSpec[] = [
  highPriorityCoverageCheck,
  uncoveredRequirementsCheck,
  unsupportedAdditionsCheck,
  unjustifiedComponentsCheck,
  integrationsMissingFromPlanCheck,
  aiUseCaseSafeguardsCheck,
  missingEstimationInputsCheck,
  unresolvedQuestionsCheck,
  conflictingCloudSelectionCheck,
  estimateConsistencyCheck,
  assumptionsNeedingValidationCheck,
  staleSectionsCheck,
];
