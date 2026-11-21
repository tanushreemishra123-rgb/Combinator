/**
 * Persisted schema for `EstimationConfig` (every number the estimator reads, see
 * `src/domain/config.ts`) and for a driver's `ComplexityOverride`.
 */
import { z } from 'zod';
import { ComplexitySchema, ConfidenceSchema, DriverTypeSchema } from '../../domain';

/** Mirrors `RoleId` in `src/domain/config.ts` - a plain union with no runtime schema there. */
const ROLE_IDS = [
  'engagement-manager',
  'solution-architect',
  'business-analyst',
  'ux-designer',
  'frontend-engineer',
  'backend-engineer',
  'data-engineer',
  'ai-engineer',
  'devops-engineer',
  'security-engineer',
  'qa-engineer',
] as const;
export const RoleIdSchema = z.enum(ROLE_IDS);

export const RoleRateSchema = z.object({
  roleId: RoleIdSchema,
  label: z.string().min(1),
  dayRate: z.number().nonnegative().nullable(),
});

export const ComplexityOverrideSchema = z.object({
  driverId: z.string().min(1),
  complexity: ComplexitySchema,
});

const BaseEffortDayCellSchema = z.object({ complexity: ComplexitySchema, value: z.number().nonnegative() });

export const BaseEffortRowSchema = z.object({
  driverType: DriverTypeSchema,
  label: z.string().min(1),
  days: z.array(BaseEffortDayCellSchema),
});

export const PhaseOverheadSchema = z.object({
  phaseId: z.string().min(1),
  label: z.string().min(1),
  pctOfBuild: z.number().nonnegative(),
});

const RoleMixShareSchema = z.object({ roleId: RoleIdSchema, pct: z.number().nonnegative() });

export const RoleMixRowSchema = z.object({
  driverType: z.union([DriverTypeSchema, z.literal('overhead')]),
  shares: z.array(RoleMixShareSchema),
});

export const ConfidenceSpreadSchema = z.object({
  confidence: ConfidenceSchema,
  lowPct: z.number().nonnegative(),
  highPct: z.number().nonnegative(),
});

export const EstimationConfigSchema = z.object({
  currency: z.string().min(1),
  contingencyPct: z.number().nonnegative(),
  productivityFactor: z.number().positive(),
  workingDaysPerWeek: z.number().positive(),
  teamSize: z.number().positive(),
  roundingUnit: z.number().positive(),
  baselineEnvironments: z.number().int().nonnegative(),
  extraEnvironmentPct: z.number().nonnegative(),
  rates: z.array(RoleRateSchema),
  baseEffort: z.array(BaseEffortRowSchema),
  phaseOverheads: z.array(PhaseOverheadSchema),
  roleMix: z.array(RoleMixRowSchema),
  confidenceSpreads: z.array(ConfidenceSpreadSchema),
});
