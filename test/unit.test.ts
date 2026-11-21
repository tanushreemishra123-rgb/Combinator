/**
 * Automated tests for the Combinator's security, determinism, and decision logic.
 * Run: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stableId } from "../src/ids.js";
import { SafeFs, SourceProtectionError } from "../src/fs-safe.js";
import { Logger } from "../src/logger.js";
import { diffHashes, hashTree } from "../src/integrity.js";
import { applyDecisionChange } from "../src/decisions.js";
import type { Decision } from "../src/types.js";

test("stableId is deterministic and reproducible", () => {
  const a = stableId.requirement("CH", "Title", "loc[0]");
  const b = stableId.requirement("CH", "Title", "loc[0]");
  assert.equal(a, b);
  assert.notEqual(a, stableId.requirement("CH", "Other", "loc[0]"));
  assert.match(a, /^REQ_/);
});

test("SafeFs confines writes to registered writable roots", () => {
  const root = mkdtempSync(join(tmpdir(), "combi-"));
  const src = join(root, "src");
  const ws = join(root, "ws");
  mkdirSync(src, { recursive: true });
  writeFileSync(join(src, "a.txt"), "hello");
  const fs = new SafeFs({ readRoots: [root], log: new Logger(false) });
  fs.allowWrite(ws);
  // Allowed: write inside workspace.
  fs.writeText(join(ws, "out.json"), "{}");
  assert.ok(existsSync(join(ws, "out.json")));
  // Denied: write into the source tree.
  assert.throws(() => fs.writeText(join(src, "evil.txt"), "x"), SourceProtectionError);
  // Denied: path traversal out of workspace.
  assert.throws(() => fs.writeText(join(ws, "..", "escape.txt"), "x"), SourceProtectionError);
});

test("SafeFs rejects symlink escape on read", () => {
  const root = mkdtempSync(join(tmpdir(), "combi-"));
  const inside = join(root, "inside");
  mkdirSync(inside, { recursive: true });
  const secretDir = mkdtempSync(join(tmpdir(), "secret-"));
  writeFileSync(join(secretDir, "secret.txt"), "top secret");
  const link = join(inside, "link");
  try {
    symlinkSync(secretDir, link);
  } catch {
    return; // symlinks unsupported here; skip
  }
  const fs = new SafeFs({ readRoots: [inside], log: new Logger(false) });
  assert.throws(() => fs.readText(join(link, "secret.txt")), SourceProtectionError);
});

test("integrity diff flags source hash mismatch as critical", () => {
  const root = mkdtempSync(join(tmpdir(), "combi-"));
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "f.txt"), "v1");
  const fs = new SafeFs({ readRoots: [root], log: new Logger(false) });
  const before = hashTree(fs, root);
  writeFileSync(join(root, "f.txt"), "v2-tampered");
  const after = hashTree(fs, root);
  const report = diffHashes("CH", before, after);
  assert.equal(report.critical, true);
  assert.equal(report.mismatches.length, 1);
});

test("integrity diff is clean when nothing changes", () => {
  const root = mkdtempSync(join(tmpdir(), "combi-"));
  writeFileSync(join(root, "f.txt"), "stable");
  const fs = new SafeFs({ readRoots: [root], log: new Logger(false) });
  const before = hashTree(fs, root);
  const after = hashTree(fs, root);
  assert.equal(diffHashes("CH", before, after).critical, false);
});

function mkDecision(): Decision {
  return {
    id: "DEC_1",
    kind: "transplant",
    title: "t",
    options: [
      { id: "OPT_a", sourceId: "SUB_002", label: "a", evidence: [], compatibilityRisk: "low" },
      { id: "OPT_b", sourceId: "SUB_001", label: "b", evidence: [], compatibilityRisk: "low" },
    ],
    recommendation: "OPT_a",
    reasoning: "r",
    risk: "low",
    state: "pending",
    selectedSource: "OPT_a",
    copilotComment: null,
    regenerationRequired: true,
    updatedAt: new Date().toISOString(),
  };
}

test("decision: accept selects the recommendation", () => {
  const res = applyDecisionChange(mkDecision(), { state: "accepted" });
  assert.ok(res.ok && res.decision.selectedSource === "OPT_a");
});

test("decision: alternative requires a valid option id", () => {
  const bad = applyDecisionChange(mkDecision(), { state: "alternative_selected" });
  assert.equal(bad.ok, false);
  const good = applyDecisionChange(mkDecision(), { state: "alternative_selected", selectedOptionId: "OPT_b" });
  assert.ok(good.ok && good.decision.selectedSource === "OPT_b");
});

test("decision: reject clears the selected source", () => {
  const res = applyDecisionChange(mkDecision(), { state: "rejected" });
  assert.ok(res.ok && res.decision.selectedSource === null);
});
