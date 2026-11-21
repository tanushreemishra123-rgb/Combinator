import { z } from "zod"
import type {
  RateCard,
  RoleRate,
  SessionConfig,
  SessionConfigInput,
  TeamSizeEntry,
} from "@/api/types"

/** Numbers stay strings in the form, so a half-typed value never becomes NaN. */
const number = (message: string) =>
  z.string().refine((value) => value.trim() !== "" && Number.isFinite(Number(value)), message)
const optionalNumber = z
  .string()
  .refine((value) => value.trim() === "" || Number.isFinite(Number(value)), "Enter a number.")

/** The Select cannot hold an empty value, so "unset" stands for "no preference". */
export const NO_PREFERENCE = "unset"

export const estimationConfigSchema = z.object({
  rate_card_id: z.string().min(1, "Choose a rate card."),
  contingency_pct: number("Contingency must be a number."),
  productivity_factor: number("Productivity factor must be a number."),
  working_weeks_per_month: number("Working weeks must be a number."),
  environments_count: number("Environments must be a number."),
  expected_users: optionalNumber,
  delivery_deadline: z.string(),
  security_level: z.enum(["standard", "elevated", "regulated"]),
  testing_level: z.enum(["standard", "extended"]),
  data_migration: z.enum(["none", "light", "heavy"]),
  ai_provider_preference: z.enum([
    NO_PREFERENCE,
    "platform_native",
    "openai",
    "anthropic",
    "google",
    "open_source",
    "none",
  ]),
  target_regions: z.string(),
  regulatory_constraints: z.string(),
  team_sizes: z.array(
    z.object({ workstream_type: z.string(), team_size: number("Team size must be a number.") }),
  ),
  // One row per role of the selected card; a changed value becomes a session override.
  role_rates: z.array(z.object({ role: z.string(), rate: number("Rate must be a number.") })),
})

export type EstimationConfigValues = z.infer<typeof estimationConfigSchema>

function list(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
}

/** The card's roles with this session's overrides applied, ready for the rate table. */
export function roleRateRows(
  card: RateCard | undefined,
  overrides: readonly RoleRate[],
): EstimationConfigValues["role_rates"] {
  if (!card) return []
  return card.rates.map((rate) => {
    const override = overrides.find((entry) => entry.role === rate.role)
    return {
      role: rate.role,
      rate: String(override?.rate_per_person_week ?? rate.rate_per_person_week),
    }
  })
}

/** Only rows that differ from the card are sent, so the card stays the source of truth. */
function toRateOverrides(
  rows: EstimationConfigValues["role_rates"],
  card: RateCard | undefined,
): RoleRate[] {
  if (!card) return []
  return rows
    .filter((row) => {
      const seeded = card.rates.find((rate) => rate.role === row.role)
      return seeded !== undefined && Number(row.rate) !== seeded.rate_per_person_week
    })
    .map((row) => ({ role: row.role, rate_per_person_week: Number(row.rate) }))
}

export function toFormValues(
  config: SessionConfig,
  card: RateCard | undefined,
  teamSizes: readonly TeamSizeEntry[],
): EstimationConfigValues {
  return {
    rate_card_id: config.rate_card_id,
    contingency_pct: String(config.contingency_pct),
    productivity_factor: String(config.productivity_factor),
    working_weeks_per_month: String(config.working_weeks_per_month),
    environments_count: String(config.environments_count),
    expected_users: config.expected_users === null ? "" : String(config.expected_users),
    delivery_deadline: config.delivery_deadline ?? "",
    security_level: config.security_level,
    testing_level: config.testing_level,
    data_migration: config.data_migration,
    ai_provider_preference: config.ai_provider_preference ?? NO_PREFERENCE,
    target_regions: config.target_regions.join(", "),
    regulatory_constraints: config.regulatory_constraints.join(", "),
    team_sizes: teamSizes.map((entry) => ({
      workstream_type: entry.workstream_type,
      team_size: String(entry.team_size),
    })),
    role_rates: roleRateRows(card, config.rate_overrides),
  }
}

/** The API replaces the whole config, so the untouched fields are carried over. */
export function toSessionConfig(
  values: EstimationConfigValues,
  current: SessionConfig,
  card: RateCard | undefined,
): SessionConfigInput {
  return {
    ...current,
    rate_card_id: values.rate_card_id,
    rate_overrides: toRateOverrides(values.role_rates, card),
    contingency_pct: Number(values.contingency_pct),
    productivity_factor: Number(values.productivity_factor),
    working_weeks_per_month: Number(values.working_weeks_per_month),
    environments_count: Number(values.environments_count),
    expected_users: values.expected_users.trim() === "" ? null : Number(values.expected_users),
    delivery_deadline: values.delivery_deadline.trim() === "" ? null : values.delivery_deadline,
    security_level: values.security_level,
    testing_level: values.testing_level,
    data_migration: values.data_migration,
    ai_provider_preference:
      values.ai_provider_preference === NO_PREFERENCE ? null : values.ai_provider_preference,
    target_regions: list(values.target_regions),
    regulatory_constraints: list(values.regulatory_constraints),
    team_sizes: values.team_sizes.map((entry) => ({
      workstream_type: entry.workstream_type,
      team_size: Number(entry.team_size),
    })),
  }
}
