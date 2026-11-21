#!/usr/bin/env node
/**
 * Topcoder Combinator CLI.
 *
 *   combinator list   --pack <dir>
 *   combinator run    <CHALLENGE_ID> --pack <dir> [--out <dir>] [--verify-exec] [--exec-timeout <ms>]
 *   combinator run-all --pack <dir> [--out <dir>] [--verify-exec]
 *   combinator decide <CHALLENGE_ID> --id <decisionId> --state <state> [--option <optId>] [--comment "..."] --pack <dir>
 *
 * `decide` applies a Copilot decision change and regenerates the affected
 * candidate/workspace (preserving all other decisions).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { loadConfig } from "./config.js";
import { runChallenge, runAll, type RunOptions } from "./orchestrator.js";
import { SafeFs } from "./fs-safe.js";
import { Logger } from "./logger.js";
import { loadManifest } from "./ingest.js";
import { resolvePackRoot } from "./materialize.js";
import { applyDecisionChange } from "./decisions.js";
import type { DecisionState, DecisionWorkspace } from "./types.js";

function arg(flags: string[], argv: string[], dflt?: string): string | undefined {
  for (const f of flags) {
    const i = argv.indexOf(f);
    if (i !== -1 && i + 1 < argv.length) return argv.at(i + 1);
  }
  return dflt;
}
function has(flag: string, argv: string[]): boolean {
  return argv.includes(flag);
}

async function main() {
  const [, , cmd, ...rest] = process.argv;
  const cfg = loadConfig();
  const packRoot = resolvePackRoot(arg(["--pack", "-p"], rest, "./starter-pack")!);
  const outDir = resolve(arg(["--out", "-o"], rest, "./workspace")!);
  const opts: RunOptions = {
    packRoot,
    outDir,
    verifyExec: has("--verify-exec", rest),
    execTimeoutMs: Number(arg(["--exec-timeout"], rest, "120000")),
  };

  switch (cmd) {
    case "list": {
      const fs = new SafeFs({ readRoots: [packRoot], log: new Logger(false) });
      const m = loadManifest(fs, packRoot);
      console.log(`Starter pack: ${m.starterPackId} (${m.challenges.length} challenges)\n`);
      for (const c of m.challenges) {
        console.log(`  ${c.challengeId}  [${c.mode}]  submissions=${c.submissionIds.length}  — ${c.title}`);
      }
      break;
    }
    case "run": {
      const id = rest[0];
      if (!id || id.startsWith("-")) fail("run requires a CHALLENGE_ID");
      const fs = new SafeFs({ readRoots: [packRoot], log: new Logger(false) });
      const m = loadManifest(fs, packRoot);
      const mc = m.challenges.find((c) => c.challengeId === id);
      if (!mc) fail(`challenge not found in manifest: ${id}`);
      const man = await runChallenge(cfg, mc!, opts);
      console.log(JSON.stringify({ ok: true, challengeId: man.challengeId, verification: man.verificationOverall, integrityCritical: man.integrityCritical }, null, 2));
      break;
    }
    case "run-all": {
      const results = await runAll(cfg, opts);
      console.log(
        JSON.stringify(
          { ok: true, challenges: results.map((r) => ({ id: r.challengeId, mode: r.mode, verification: r.verificationOverall, integrityCritical: r.integrityCritical })) },
          null,
          2,
        ),
      );
      break;
    }
    case "decide": {
      const id = rest[0];
      if (!id || id.startsWith("-")) fail("decide requires a CHALLENGE_ID");
      const decisionId = arg(["--id"], rest);
      const state = arg(["--state"], rest) as DecisionState | undefined;
      if (!decisionId || !state) fail("decide requires --id and --state");
      const decisionsPath = join(outDir, id!, "decisions.json");
      if (!existsSync(decisionsPath)) fail(`no decisions.json for ${id}; run it first`);
      const dw = JSON.parse(readFileSync(decisionsPath, "utf8")) as DecisionWorkspace;
      const target = dw.decisions.find((d) => d.id === decisionId);
      if (!target) fail(`decision ${decisionId} not found`);
      const res = applyDecisionChange(target!, {
        state: state!,
        selectedOptionId: arg(["--option"], rest),
        comment: arg(["--comment"], rest),
      });
      if (!res.ok) fail(res.error);
      dw.decisions = dw.decisions.map((d) => (d.id === decisionId ? res.decision : d));
      // Regenerate with the overlay.
      const fs = new SafeFs({ readRoots: [packRoot], log: new Logger(false) });
      const m = loadManifest(fs, packRoot);
      const mc = m.challenges.find((c) => c.challengeId === id)!;
      const man = await runChallenge(cfg, mc, { ...opts, overlayDecisions: dw });
      console.log(JSON.stringify({ ok: true, applied: { decisionId, state }, regenerated: man.challengeId, verification: man.verificationOverall }, null, 2));
      break;
    }
    default:
      console.log(
        [
          "Topcoder Combinator",
          "",
          "Commands:",
          "  list                      List challenges in the starter pack",
          "  run <ID>                  Run one challenge end-to-end",
          "  run-all                   Run every challenge in the manifest",
          "  decide <ID> --id <d> --state <s> [--option <o>] [--comment ..]",
          "                            Apply a Copilot decision change and regenerate",
          "",
          "Flags: --pack <dir> (default ./starter-pack), --out <dir> (default ./workspace),",
          "       --verify-exec (run dynamic build/test steps), --exec-timeout <ms>",
        ].join("\n"),
      );
  }
}

function fail(msg: string): never {
  console.error(`[combinator] error: ${msg}`);
  process.exit(1);
}

main().catch((e) => {
  console.error(e?.stack ?? String(e));
  process.exit(1);
});
