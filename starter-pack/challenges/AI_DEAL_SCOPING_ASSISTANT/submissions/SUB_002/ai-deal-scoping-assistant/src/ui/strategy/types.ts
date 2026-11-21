/** Local tab ids for this workspace (not part of the state-layer navigation contract). */
export const STRATEGY_TAB_IDS = ['data-strategy', 'integration-architecture', 'ai-solution'] as const;

export type StrategyTabId = (typeof STRATEGY_TAB_IDS)[number];

export function isStrategyTabId(value: string): value is StrategyTabId {
  return (STRATEGY_TAB_IDS as readonly string[]).includes(value);
}
