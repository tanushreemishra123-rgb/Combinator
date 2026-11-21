import type { ArtifactKind } from "@/api/types"

// Session detail and the data below a session use different roots so that invalidating
// one session's record does not refetch its documents, scope and artifacts as well.
const SESSIONS = "sessions"
const DATA = "session-data"

export const queryKeys = {
  health: ["health"] as const,
  system: ["system"] as const,
  scenarios: ["scenarios"] as const,
  rateCards: ["rate-cards"] as const,
  historicalProjects: ["historical-projects"] as const,
  sessions: [SESSIONS] as const,
  session: (sessionId: string) => [SESSIONS, sessionId] as const,
  /** Everything stored below one session. */
  sessionData: (sessionId: string) => [DATA, sessionId] as const,
  documents: (sessionId: string) => [DATA, sessionId, "documents"] as const,
  document: (sessionId: string, documentId: string) =>
    [DATA, sessionId, "documents", documentId] as const,
  scope: (sessionId: string) => [DATA, sessionId, "scope"] as const,
  artifacts: (sessionId: string) => [DATA, sessionId, "artifacts"] as const,
  artifact: (sessionId: string, kind: ArtifactKind) =>
    [DATA, sessionId, "artifacts", kind] as const,
  estimationConfig: (sessionId: string) => [DATA, sessionId, "estimation-config"] as const,
  estimate: (sessionId: string) => [DATA, sessionId, "estimate"] as const,
  changes: (sessionId: string) => [DATA, sessionId, "changes"] as const,
  quality: (sessionId: string) => [DATA, sessionId, "quality-gate"] as const,
  coverage: (sessionId: string) => [DATA, sessionId, "coverage"] as const,
  diagrams: (sessionId: string) => [DATA, sessionId, "diagrams"] as const,
  packageDocument: (sessionId: string) => [DATA, sessionId, "package"] as const,
}

/** Which keys each kind of mutation makes stale. */
export const invalidatedBy = {
  sessionWrite: (sessionId: string) => [queryKeys.sessions, queryKeys.session(sessionId)],
  documentWrite: (sessionId: string) => [
    queryKeys.documents(sessionId),
    queryKeys.session(sessionId),
  ],
  analysis: (sessionId: string) => [queryKeys.scope(sessionId), queryKeys.session(sessionId)],
  scopeEdit: (sessionId: string) => [queryKeys.scope(sessionId), queryKeys.session(sessionId)],
  scopeApproval: (sessionId: string) => [
    queryKeys.scope(sessionId),
    queryKeys.session(sessionId),
    queryKeys.sessions,
    queryKeys.coverage(sessionId),
  ],
  // A change can touch every generated deliverable, so the whole session is refetched.
  change: (sessionId: string) => [
    queryKeys.session(sessionId),
    queryKeys.sessionData(sessionId),
    queryKeys.sessions,
  ],
  generation: (sessionId: string) => [
    queryKeys.artifacts(sessionId),
    queryKeys.session(sessionId),
    queryKeys.coverage(sessionId),
    queryKeys.quality(sessionId),
    queryKeys.diagrams(sessionId),
    queryKeys.packageDocument(sessionId),
  ],
  estimateWrite: (sessionId: string) => [
    queryKeys.estimate(sessionId),
    queryKeys.estimationConfig(sessionId),
    queryKeys.artifacts(sessionId),
    queryKeys.quality(sessionId),
    queryKeys.packageDocument(sessionId),
  ],
  qualityRun: (sessionId: string) => [
    queryKeys.quality(sessionId),
    queryKeys.packageDocument(sessionId),
  ],
  packageBuild: (sessionId: string) => [
    queryKeys.packageDocument(sessionId),
    queryKeys.quality(sessionId),
  ],
}
