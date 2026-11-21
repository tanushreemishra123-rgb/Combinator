/**
 * Deterministic mock provider. Produces grounded narration from the structured
 * `grounding` passed with each request — no network, no key, identical output
 * for identical input (reproducibility). It never invents facts: it only
 * verbalizes the signals the deterministic core already computed.
 */
import { estimateTokens, type LlmAdapter, type LlmRequest, type LlmResponse } from "./adapter.js";

export class MockAdapter implements LlmAdapter {
  readonly name = "mock";
  readonly model = "deterministic-mock-v1";

  async complete(req: LlmRequest): Promise<LlmResponse> {
    const text = this.render(req);
    return {
      text,
      inputTokens: estimateTokens(req.system + req.user + JSON.stringify(req.grounding ?? {})),
      outputTokens: estimateTokens(text),
      retries: 0,
    };
  }

  private render(req: LlmRequest): string {
    const g = req.grounding ?? {};
    switch (req.task) {
      case "architecture.summary": {
        const apps = (g.applications as Array<{ path: string; stack: string[]; role: string }>) ?? [];
        if (apps.length === 0) return "No application code was detected in this submission.";
        const parts = apps.map(
          (a) => `${a.role} at ${a.path} (${a.stack.join(", ") || "stack undetermined"})`,
        );
        return `Detected ${apps.length} application unit(s): ${parts.join("; ")}. ${
          (g.note as string) ?? ""
        }`.trim();
      }
      case "base.reasoning": {
        return (
          (g.summary as string) ??
          `Base suitability derived from coverage=${g.coverage}, tests=${g.tests}, build=${g.build}, risk=${g.risk}.`
        );
      }
      case "idea.synthesis": {
        const title = (g.title as string) ?? "Synthesized concept";
        const accepted = (g.acceptedElements as string[]) ?? [];
        return `${title}: an integrated concept combining the accepted elements — ${accepted.join("; ") || "(none accepted yet)"}. Bridging statements are labeled as assumptions and no unsupported metrics were added.`;
      }
      case "requirement.reasoning": {
        return (
          (g.summary as string) ??
          `Recommended ${g.recommendedSource} based on the strongest grounded evidence for this requirement.`
        );
      }
      default:
        // Generic faithful echo of grounding.
        return typeof g.summary === "string"
          ? (g.summary as string)
          : `(${req.task}) ${Object.keys(g).length ? JSON.stringify(g) : req.user.slice(0, 200)}`;
    }
  }
}
