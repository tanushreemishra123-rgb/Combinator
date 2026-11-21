/**
 * Integrated Scoping Package use cases (spec section 6): the executive summary, the package export
 * in every supported format and the workspace backup. An export always carries the quality gate's
 * Export Status, so a package that still needs review is downloaded as a clearly-stamped draft.
 */
import { resolveRunOptions } from '../../ai';
import type { ExportFormat, ExportStatus, PackageDocument, ScopingSession } from '../../domain';
import { buildPackageDiagrams, downloadFile, fileNameFor, generateExecutiveSummary, toDocx, toHtml, toMarkdown, toWorkspaceJson } from '../../export';
import { runQualityGate } from '../../quality';
import { buildPackageForSession, selectIsQualityReportOutdated } from '../selectors';
import type { UseCaseDeps } from '../types';
import { notify, notifyFallback, requireActiveSession, runBusy, runGuarded, saveSession } from './support';

const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const JSON_MIME_TYPE = 'application/json';

interface ExportFile {
  content: string | Uint8Array;
  mimeType: string;
}

/** `doc` is the format-neutral package; JSON is the raw, schema-validated workspace instead. */
function serialise(format: ExportFormat, doc: PackageDocument, session: ScopingSession): ExportFile {
  switch (format) {
    case 'markdown':
      return { content: toMarkdown(doc), mimeType: 'text/markdown' };
    case 'html':
      return { content: toHtml(doc, buildPackageDiagrams(session)), mimeType: 'text/html' };
    case 'docx':
      return { content: toDocx(doc), mimeType: DOCX_MIME_TYPE };
    case 'json':
      return { content: toWorkspaceJson(session), mimeType: JSON_MIME_TYPE };
  }
}

function notifyExported(deps: UseCaseDeps, fileName: string, status: ExportStatus): void {
  if (status === 'Ready') {
    notify(deps, 'success', 'Scoping package exported', `Exported ${fileName} - export status: Ready.`);
    return;
  }
  const next = status === 'Blocked' ? 'Resolve the failed quality gate checks before sharing it.' : 'Review the quality gate warnings before sharing it.';
  notify(deps, 'warning', 'Scoping package exported as draft', `Exported as draft (${fileName}) - export status: ${status}. ${next}`);
}

/** Writes the executive summary from the current deliverables (mock planner or live provider). */
export async function refreshExecutiveSummary(deps: UseCaseDeps): Promise<void> {
  const session = requireActiveSession(deps);
  if (session === null) {
    return;
  }
  const { aiSettings } = deps.getState();
  await runBusy(deps, { label: 'Writing the executive summary...', stageId: null, errorTitle: 'Executive summary failed', fallback: undefined }, async () => {
    const { summary, meta } = await generateExecutiveSummary(session, resolveRunOptions(aiSettings, session.scope?.version ?? 0));
    saveSession(deps, { ...session, executiveSummary: summary });
    notify(deps, 'success', 'Executive summary updated', `Written by ${meta.providerLabel}. Review it before export.`);
    notifyFallback(deps, 'Executive summary', meta);
  });
}

/**
 * Exports the integrated package. The quality gate runs first when no current report exists or the
 * cached one is stale (a scope edit or regeneration since it last ran), so the file is always
 * stamped with a real, current Export Status; returns that status (null on failure).
 */
export async function exportPackage(deps: UseCaseDeps, format: ExportFormat): Promise<ExportStatus | null> {
  const active = requireActiveSession(deps);
  if (active === null) {
    return null;
  }
  const { aiSettings } = deps.getState();
  return runBusy<ExportStatus | null>(deps, { label: 'Preparing the scoping package...', stageId: null, errorTitle: 'Export failed', fallback: null }, async () => {
    const now = deps.now();
    const cachedQuality = active.quality;
    const quality = cachedQuality !== null && !selectIsQualityReportOutdated(active) ? cachedQuality : runQualityGate(active, now);
    const session = quality === cachedQuality ? active : saveSession(deps, { ...active, quality });
    const status = quality.summary.exportStatus;
    const file = serialise(format, buildPackageForSession(session, aiSettings, now), session);
    const fileName = fileNameFor(session, format);
    downloadFile(fileName, file.content, file.mimeType);
    notifyExported(deps, fileName, status);
    return status;
  });
}

/**
 * Downloads a session as workspace JSON (backup / hand-off; it never contains an API key).
 * With `sessionId`, exports that session directly - whether or not it is the active one - so a
 * caller never has to select a session first just to export it.
 */
export function exportWorkspace(deps: UseCaseDeps, sessionId?: string): void {
  const session =
    sessionId === undefined ? requireActiveSession(deps) : (deps.getState().sessions.find((candidate) => candidate.id === sessionId) ?? null);
  if (session === null) {
    if (sessionId !== undefined) {
      notify(deps, 'error', 'Workspace export failed', 'That session no longer exists.');
    }
    return;
  }
  runGuarded(deps, 'Workspace export failed', undefined, () => {
    const fileName = fileNameFor(session, 'json');
    downloadFile(fileName, toWorkspaceJson(session), JSON_MIME_TYPE);
    notify(deps, 'success', 'Workspace exported', `Saved ${fileName}. Import it from the sessions dialog to continue later.`);
  });
}
