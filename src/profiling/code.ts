/**
 * Code submission profiling (challenge §Submission and Idea Profiling).
 *
 * Fully deterministic static analysis of the real submission tree:
 *  - monorepo-aware application detection (nested package.json / pyproject /
 *    requirements.txt / Dockerfile / compose),
 *  - stack detection from manifests,
 *  - build & test command discovery,
 *  - requirement coverage via grounded keyword evidence against active
 *    requirement IDs,
 *  - strengths / weaknesses / compatibility risk / base suitability.
 *
 * Every material claim carries a SourceLocation (file + optional line). The LLM
 * only narrates the architecture summary; all states and evidence are computed.
 */
import { basename, dirname, relative, sep } from "node:path";
import type { SafeFs } from "../fs-safe.js";
import type { DiscoveredChallenge, DiscoveredSubmission } from "../ingest.js";
import { pkgRelative } from "../ingest.js";
import { stableId } from "../ids.js";
import { pick } from "../util.js";
import type { LlmAdapter } from "../llm/adapter.js";
import type {
  AssessmentState,
  CodeSubmissionProfile,
  CompatibilityRisk,
  Evidence,
  Requirement,
  RequirementCoverage,
  SourceLocation,
} from "../types.js";

const STACK_SIGNATURES: Array<{ dep: RegExp; label: string }> = [
  { dep: /^react$/, label: "React" },
  { dep: /^next$/, label: "Next.js" },
  { dep: /^vite$/, label: "Vite" },
  { dep: /^vue$/, label: "Vue" },
  { dep: /^@angular\/core$/, label: "Angular" },
  { dep: /^svelte$/, label: "Svelte" },
  { dep: /^express$/, label: "Express" },
  { dep: /^fastify$/, label: "Fastify" },
  { dep: /^@nestjs\/core$/, label: "NestJS" },
  { dep: /^koa$/, label: "Koa" },
  { dep: /^typescript$/, label: "TypeScript" },
  { dep: /^prisma$|^@prisma\/client$/, label: "Prisma" },
  { dep: /^drizzle-orm$/, label: "Drizzle" },
];

function detectAppsFromManifests(fs: SafeFs, sub: DiscoveredSubmission) {
  const apps: CodeSubmissionProfile["applications"] = [];
  for (const file of sub.files) {
    const name = basename(file);
    if (name === "package.json" && !file.includes(`${sep}node_modules${sep}`)) {
      let pkg: any = {};
      try {
        pkg = JSON.parse(fs.readText(file));
      } catch {
        /* ignore malformed */
      }
      const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
      const stack = new Set<string>();
      for (const d of Object.keys(deps)) {
        for (const sig of STACK_SIGNATURES) if (sig.dep.test(d)) stack.add(sig.label);
      }
      const dir = dirname(file);
      const lower = dir.toLowerCase();
      let role: CodeSubmissionProfile["applications"][number]["role"] = "unknown";
      if (/front|web|client|ui/.test(lower) || stack.has("React") || stack.has("Next.js") || stack.has("Vite"))
        role = "frontend";
      else if (/back|server|api|service/.test(lower) || stack.has("Express") || stack.has("Fastify"))
        role = "backend";
      else if (/packages?\//.test(lower + "/") || /shared|types|common|core/.test(lower)) role = "shared";
      apps.push({ path: dir, stack: [...stack], role });
    }
    if (name === "requirements.txt" || name === "pyproject.toml") {
      const dir = dirname(file);
      apps.push({
        path: dir,
        stack: ["Python"],
        role: /back|server|api|service/.test(dir.toLowerCase()) ? "backend" : "unknown",
      });
    }
    if (name === "docker-compose.yml" || name === "docker-compose.yaml" || name === "Dockerfile") {
      apps.push({ path: dirname(file), stack: ["Docker"], role: "infra" });
    }
  }
  // Deduplicate by path, merging stacks.
  const byPath = new Map<string, CodeSubmissionProfile["applications"][number]>();
  for (const a of apps) {
    const existing = byPath.get(a.path);
    if (existing) {
      existing.stack = [...new Set([...existing.stack, ...a.stack])];
      if (existing.role === "unknown") existing.role = a.role;
      if (existing.role === "infra" && a.role !== "infra") existing.role = a.role;
    } else byPath.set(a.path, { ...a });
  }
  return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
}

function discoverBuildCommands(fs: SafeFs, sub: DiscoveredSubmission): { commands: string[]; evidence: Evidence[] } {
  const commands: string[] = [];
  const evidence: Evidence[] = [];
  for (const file of sub.files) {
    if (basename(file) === "package.json" && !file.includes(`${sep}node_modules${sep}`)) {
      try {
        const pkg = JSON.parse(fs.readText(file));
        const scripts = pkg.scripts ?? {};
        for (const key of ["build", "start", "dev"]) {
          if (pick(scripts, key)) {
            commands.push(`npm run ${key}  (${relative(sub.rootPath, dirname(file)) || "."})`);
          }
        }
        if (scripts.build || scripts.start) {
          evidence.push(mkEvidence("build", `scripts present: ${Object.keys(scripts).join(", ")}`, [
            { kind: "file", submissionId: sub.submissionId, path: file, excerpt: "package.json scripts" },
          ]));
        }
      } catch {
        /* ignore */
      }
    }
  }
  return { commands, evidence };
}

function detectTests(fs: SafeFs, sub: DiscoveredSubmission): { state: AssessmentState; frameworks: string[]; evidence: Evidence[] } {
  const frameworks = new Set<string>();
  const testFiles: string[] = [];
  for (const file of sub.files) {
    const n = basename(file).toLowerCase();
    if (/\.(test|spec)\.[tj]sx?$/.test(n) || /_test\.py$|test_.*\.py$/.test(n)) testFiles.push(file);
    if (n === "package.json" && !file.includes(`${sep}node_modules${sep}`)) {
      try {
        const pkg = JSON.parse(fs.readText(file));
        const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
        for (const d of Object.keys(deps)) {
          if (/jest/.test(d)) frameworks.add("Jest");
          if (/vitest/.test(d)) frameworks.add("Vitest");
          if (/mocha/.test(d)) frameworks.add("Mocha");
          if (/playwright/.test(d)) frameworks.add("Playwright");
          if (/cypress/.test(d)) frameworks.add("Cypress");
        }
      } catch {
        /* ignore */
      }
    }
    if (n === "pytest.ini" || n === "conftest.py") frameworks.add("pytest");
  }
  const evidence: Evidence[] = [];
  if (testFiles.length) {
    evidence.push(
      mkEvidence("tests", `${testFiles.length} test file(s) found`, [
        {
          kind: "test",
          submissionId: sub.submissionId,
          path: testFiles[0]!,
          excerpt: `example of ${testFiles.length} test files`,
        },
      ]),
    );
  }
  const state: AssessmentState = testFiles.length > 0 ? "complete" : frameworks.size ? "partial" : "missing";
  return { state, frameworks: [...frameworks], evidence };
}

let evidenceCounter = 0;
function mkEvidence(
  topic: string,
  statement: string,
  locations: SourceLocation[],
  origin: Evidence["origin"] = "source",
  confidence: Evidence["confidence"] = "high",
): Evidence {
  return { id: stableId.evidence(topic, statement, String(evidenceCounter++)), statement, locations, origin, confidence };
}

/** Grounded requirement coverage: look for keyword evidence across the tree. */
function coverRequirement(
  fs: SafeFs,
  sub: DiscoveredSubmission,
  req: Requirement,
): RequirementCoverage {
  // Build a keyword set from the requirement title + constraints.
  const words = (req.title + " " + req.constraints.map((c) => c.text).join(" "))
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 5 && !STOP.has(w));
  const keywords = [...new Set(words)].slice(0, 10);
  const hits: SourceLocation[] = [];
  const textFiles = sub.files.filter((f) => /\.(ts|tsx|js|jsx|py|md|json|yml|yaml)$/.test(f));
  let distinctFiles = 0;
  let totalHits = 0;
  let testFileHits = 0;
  let scanned = 0;
  for (const f of textFiles) {
    if (scanned > 800) break;
    scanned++;
    let text = "";
    try {
      text = fs.readText(f).toLowerCase();
    } catch {
      continue;
    }
    const matched = keywords.filter((k) => text.includes(k));
    if (matched.length >= 2) {
      distinctFiles++;
      totalHits += matched.length;
      if (/\.(test|spec)\.[tj]sx?$|_test\.py$|test_.*\.py$/.test(f)) testFileHits++;
      if (hits.length < 4) {
        hits.push({
          kind: /\.(test|spec)\./.test(f) ? "test" : "file",
          submissionId: sub.submissionId,
          path: f,
          excerpt: `matches: ${matched.slice(0, 5).join(", ")}`,
        });
      }
    }
  }
  // Grounded strength, BOUNDED so it reflects how well a requirement is addressed
  // rather than raw repository size. Diminishing returns on breadth; rewards
  // keyword density per file and the presence of tests for the requirement.
  const breadth = Math.min(distinctFiles, 6) * 1.5; // cap breadth (0..9)
  const density = distinctFiles > 0 ? Math.min(totalHits / distinctFiles, 5) : 0; // avg hits/file (0..5)
  const testBonus = Math.min(testFileHits, 3) * 2; // (0..6)
  const score = Math.round((breadth + density + testBonus) * 10) / 10; // ~0..20
  let state: AssessmentState;
  if (score >= 10) state = "complete";
  else if (score >= 3) state = "partial";
  else if (score > 0) state = "partial";
  else state = "missing";
  const evidence = hits.length
    ? [
        mkEvidence(
          `cover.${req.id}`,
          `Grounded evidence for "${req.title}" (${distinctFiles} files, ${totalHits} hits, strength ${score.toFixed(1)})`,
          hits,
        ),
      ]
    : [];
  return {
    requirementId: req.id,
    state,
    score: Math.round(score * 10) / 10,
    evidence,
    notes: hits.length
      ? `Grounded in ${distinctFiles} file(s); ${testFileHits} test file(s); strength ${score.toFixed(1)}.`
      : "No grounded signal found for this requirement in the submission tree.",
  };
}

const STOP = new Set([
  "requirement",
  "requirements",
  "content",
  "distinct",
  "reviewed",
  "visible",
  "output",
  "major",
  "specific",
  "complete",
  "separate",
  "identifies",
  "connect",
  "values",
  "using",
  "their",
  "there",
  "which",
  "these",
  "between",
  "becomes",
]);

export async function profileCodeSubmission(
  fs: SafeFs,
  challenge: DiscoveredChallenge,
  sub: DiscoveredSubmission,
  requirements: Requirement[],
  llm: LlmAdapter,
  reviewEvidence: Evidence[],
): Promise<CodeSubmissionProfile> {
  if (sub.files.length === 0) {
    return emptyProfile(sub, requirements, "No files present (submission not inserted into the pack).");
  }

  const applications = detectAppsFromManifests(fs, sub);
  const build = discoverBuildCommands(fs, sub);
  const tests = detectTests(fs, sub);
  const requirementCoverage = requirements.map((r) => coverRequirement(fs, sub, r));

  const covered = requirementCoverage.filter((c) => c.state === "complete").length;
  const partial = requirementCoverage.filter((c) => c.state === "partial").length;
  const coverageRatio = requirements.length ? (covered + partial * 0.5) / requirements.length : 0;

  // Compatibility risk: more languages / app units / Docker-only builds raise risk.
  const langs = new Set(applications.flatMap((a) => a.stack));
  const polyglot = langs.has("Python") && (langs.has("TypeScript") || langs.has("React"));
  const risk: CompatibilityRisk =
    applications.length >= 4 || polyglot ? "high" : applications.length >= 2 ? "medium" : "low";

  // Base suitability score (0..100), deterministic.
  const score = Math.round(
    coverageRatio * 55 +
      (tests.state === "complete" ? 20 : tests.state === "partial" ? 10 : 0) +
      (build.commands.length ? 15 : 0) +
      (risk === "low" ? 10 : risk === "medium" ? 5 : 0),
  );

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  if (tests.state === "complete") strengths.push(`Has automated tests (${tests.frameworks.join(", ") || "detected"}).`);
  else weaknesses.push("No or minimal automated tests detected.");
  if (build.commands.length) strengths.push("Build/start scripts are present and discoverable.");
  else weaknesses.push("No build/start scripts discovered — verification commands may be manual.");
  if (coverageRatio >= 0.6) strengths.push(`Covers ~${Math.round(coverageRatio * 100)}% of active requirements (grounded).`);
  else weaknesses.push(`Low grounded requirement coverage (~${Math.round(coverageRatio * 100)}%).`);
  if (risk !== "low") weaknesses.push(`Integration risk ${risk} (${applications.length} app units, langs: ${[...langs].join(", ")}).`);

  const archNarration = await llm.complete({
    task: "architecture.summary",
    system: "You summarize software architecture faithfully from detected signals. Do not invent components.",
    user: `Summarize the architecture of submission ${sub.submissionId}.`,
    grounding: {
      applications: applications.map((a) => ({ path: pkgRelative(challenge.packageRoot, a.path), stack: a.stack, role: a.role })),
      note: `Detected ${applications.length} unit(s); languages: ${[...langs].join(", ") || "unknown"}.`,
    },
  });

  const archEvidence = applications.slice(0, 4).map((a) =>
    mkEvidence("arch", `${a.role} unit (${a.stack.join(", ") || "stack n/a"})`, [
      { kind: "file", submissionId: sub.submissionId, path: a.path, excerpt: "application root" },
    ]),
  );

  return {
    submissionId: sub.submissionId,
    kind: "code",
    rootPath: sub.rootPath,
    applications: applications.map((a) => ({ ...a, path: pkgRelative(challenge.packageRoot, a.path) })),
    architecture: { summary: archNarration.text, evidence: archEvidence },
    build: { state: build.commands.length ? "complete" : "missing", commands: build.commands, evidence: build.evidence },
    tests,
    requirementCoverage,
    strengths,
    weaknesses,
    reviewEvidence,
    compatibilityRisk: risk,
    baseSuitability: {
      score,
      reasoning: `coverage≈${Math.round(coverageRatio * 100)}%, tests=${tests.state}, build=${
        build.commands.length ? "present" : "absent"
      }, risk=${risk}.`,
    },
  };
}

function emptyProfile(
  sub: DiscoveredSubmission,
  requirements: Requirement[],
  reason: string,
): CodeSubmissionProfile {
  return {
    submissionId: sub.submissionId,
    kind: "code",
    rootPath: sub.rootPath,
    applications: [],
    architecture: { summary: reason, evidence: [] },
    build: { state: "not_verifiable", commands: [], evidence: [] },
    tests: { state: "not_verifiable", frameworks: [], evidence: [] },
    requirementCoverage: requirements.map((r) => ({
      requirementId: r.id,
      state: "not_verifiable" as AssessmentState,
      score: 0,
      evidence: [],
      notes: reason,
    })),
    strengths: [],
    weaknesses: [reason],
    reviewEvidence: [],
    compatibilityRisk: "unknown",
    baseSuitability: { score: 0, reasoning: reason },
  };
}
