/**
 * Local review UI server (challenge §Copilot Decision Workflow / review UI).
 *
 * Files are the source of truth. This dependency-free HTTP server reads the
 * generated workspace JSON and lets the Copilot inspect evidence, change a
 * decision (accept / reject / alternative / block / manual_review), add a
 * comment, and trigger regeneration — which re-runs the pipeline with the saved
 * decisions overlaid and refreshes verification + provenance.
 *
 * It never touches source submissions; all writes go through the orchestrator's
 * SafeFs, confined to the workspace.
 */
import { createServer } from "node:http";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { SafeFs } from "./fs-safe.js";
import { Logger } from "./logger.js";
import { loadManifest } from "./ingest.js";
import { resolvePackRoot } from "./materialize.js";
import { runChallenge } from "./orchestrator.js";
import { applyDecisionChange } from "./decisions.js";
import { pick } from "./util.js";
import type { DecisionState, DecisionWorkspace } from "./types.js";
import { fileURLToPath } from "node:url";

const cfg = loadConfig();
const PACK = resolvePackRoot(process.env.COMBINATOR_PACK || "./starter-pack");
const OUT = resolve(process.env.COMBINATOR_OUT || "./workspace");
const PUBLIC = fileURLToPath(new URL("../public/", import.meta.url));

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function readJsonSafe(p: string): unknown {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function listChallenges(): string[] {
  if (!existsSync(OUT)) return [];
  return readdirSync(OUT).filter((d) => statSync(join(OUT, d)).isDirectory());
}

function workspaceBundle(id: string): unknown {
  const dir = join(OUT, id);
  const read = (f: string) => readJsonSafe(join(dir, f));
  const conceptPath = join(dir, "synthesized-concept", "concept.md");
  return {
    manifest: read("workspace-manifest.json"),
    overview: existsSync(join(dir, "overview.md")) ? readFileSync(join(dir, "overview.md"), "utf8") : null,
    reviewContextStatus: read("review-context-status.json"),
    reconciliation: read("review-context-reconciliation.json"),
    matrix: read("requirement-matrix.json"),
    decisions: read("decisions.json"),
    provenance: read("provenance.json"),
    contradictions: read("contradictions.json"),
    verification: read("verification.json"),
    usage: read("usage-report.json"),
    concept: existsSync(conceptPath) ? readFileSync(conceptPath, "utf8") : null,
  };
}

function send(res: import("node:http").ServerResponse, code: number, body: unknown, type = "application/json") {
  const payload = type.startsWith("application/json") ? JSON.stringify(body) : String(body);
  res.writeHead(code, { "content-type": type });
  res.end(payload);
}

async function regenerate(id: string, dw: DecisionWorkspace) {
  const fs = new SafeFs({ readRoots: [PACK], log: new Logger(false) });
  const manifest = loadManifest(fs, PACK);
  const mc = manifest.challenges.find((c) => c.challengeId === id);
  if (!mc) throw new Error(`unknown challenge ${id}`);
  return runChallenge(cfg, mc, {
    packRoot: PACK,
    outDir: OUT,
    verifyExec: false,
    execTimeoutMs: 120000,
    overlayDecisions: dw,
  });
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://localhost`);
    const path = url.pathname;

    if (path === "/" || path === "/index.html") {
      return send(res, 200, readFileSync(join(PUBLIC, "index.html"), "utf8"), MIME[".html"]!);
    }
    if (path.startsWith("/static/")) {
      const file = join(PUBLIC, path.slice("/static/".length));
      if (existsSync(file)) return send(res, 200, readFileSync(file, "utf8"), pick<string>(MIME, extname(file)) ?? "text/plain");
      return send(res, 404, { error: "not found" });
    }
    if (path === "/api/challenges") {
      return send(res, 200, { challenges: listChallenges() });
    }
    const wsMatch = path.match(/^\/api\/workspace\/([A-Za-z0-9_\-]+)$/);
    if (wsMatch) {
      const id = wsMatch[1]!;
      if (!listChallenges().includes(id)) return send(res, 404, { error: "unknown challenge" });
      return send(res, 200, workspaceBundle(id));
    }
    const decideMatch = path.match(/^\/api\/decide\/([A-Za-z0-9_\-]+)$/);
    if (decideMatch && req.method === "POST") {
      const id = decideMatch[1]!;
      let body = "";
      for await (const chunk of req) body += chunk;
      const { decisionId, state, selectedOptionId, comment } = JSON.parse(body || "{}") as {
        decisionId: string;
        state: DecisionState;
        selectedOptionId?: string;
        comment?: string;
      };
      const dw = readJsonSafe(join(OUT, id, "decisions.json")) as DecisionWorkspace | null;
      if (!dw) return send(res, 404, { error: "no decisions for challenge" });
      const target = dw.decisions.find((d) => d.id === decisionId);
      if (!target) return send(res, 404, { error: "decision not found" });
      const applied = applyDecisionChange(target, { state, selectedOptionId, comment });
      if (!applied.ok) return send(res, 400, { error: applied.error });
      dw.decisions = dw.decisions.map((d) => (d.id === decisionId ? applied.decision : d));
      await regenerate(id, dw);
      return send(res, 200, { ok: true, workspace: workspaceBundle(id) });
    }

    return send(res, 404, { error: "not found" });
  } catch (e) {
    return send(res, 500, { error: (e as Error).message });
  }
});

server.listen(cfg.uiPort, () => {
  process.stdout.write(
    `Combinator review UI → http://localhost:${cfg.uiPort}\n  pack: ${PACK}\n  workspace: ${OUT}\n`,
  );
});
