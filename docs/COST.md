# Cost & usage reporting

Every run writes `usage-report.json` with: `provider, model, calls, inputTokens,
outputTokens, retries, failures, approxCostUsd, processingMs`.

## Cost model
Approximate cost is computed from token counts and a configurable per-1K-token price:

```
approxCostUsd = inputTokens/1000 * COMBINATOR_COST_PER_1K_INPUT
             + outputTokens/1000 * COMBINATOR_COST_PER_1K_OUTPUT
```

Defaults (override in `.env` to match your contract):

| Var | Default (USD / 1K) |
| --- | --- |
| `COMBINATOR_COST_PER_1K_INPUT` | 0.00015 |
| `COMBINATOR_COST_PER_1K_OUTPUT` | 0.0006 |

## Mock mode cost
`mock` makes **no network calls** and incurs **no real cost**. Token counts are
*estimated* (chars/4) only so the reporting pipeline is exercised identically to a live
provider; the reported `approxCostUsd` for mock is therefore a synthetic figure, not a
charge.

## Typical footprint
The LLM is used only for short **narration** (architecture summaries, idea summaries,
synthesis prose) — a handful of small calls per challenge (observed: 2 calls per code
challenge, ~7 for the ideation challenge). All decision logic, matrices, verification
and integrity are computed without the LLM, so switching to a live provider adds modest
cost and never changes the grounded facts.

## Controls
`COMBINATOR_LLM_MAX_TOKENS`, `COMBINATOR_LLM_TEMPERATURE` (default 0 for
reproducibility), `COMBINATOR_LLM_TIMEOUT_MS`, `COMBINATOR_LLM_MAX_RETRIES` bound every
call; retries and failures are counted in the usage report.
