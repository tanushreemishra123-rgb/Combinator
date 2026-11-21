/**
 * Customer requirements input use cases (spec section 1 "Requirement intake"): the pasted text,
 * the opportunity context and uploaded documents. None of these run the analysis - they only keep
 * the primary grounding source up to date on the active session.
 */
import type { CustomerContext, ScopingSession } from '../../domain';
import { readRequirementsFile } from '../../ingestion';
import { getScenario } from '../../seed';
import type { UseCaseDeps } from '../types';
import { findActiveSession, notify, requireActiveSession, runBusy, saveSession } from './support';

/**
 * A recorded mock response is only valid for a seed scenario's own, unedited text - so the link to
 * the scenario is dropped as soon as the text differs, and custom text is analysed heuristically.
 */
function scenarioIdFor(session: ScopingSession, text: string): string | null {
  const { scenarioId } = session.input;
  if (scenarioId === null) {
    return null;
  }
  return getScenario(scenarioId)?.requirementsText === text ? scenarioId : null;
}

function withRequirementsText(session: ScopingSession, text: string): ScopingSession {
  return { ...session, input: { ...session.input, rawText: text, scenarioId: scenarioIdFor(session, text) } };
}

/** Replaces the requirements text; clears the seed-scenario link once the text is no longer the seed's. */
export function setRequirementsText(deps: UseCaseDeps, text: string): void {
  const session = requireActiveSession(deps);
  if (session === null) {
    return;
  }
  saveSession(deps, withRequirementsText(session, text));
}

/** Merges a partial edit into the customer / opportunity context (secondary grounding source). */
export function setCustomerContext(deps: UseCaseDeps, patch: Partial<CustomerContext>): void {
  const session = requireActiveSession(deps);
  if (session === null) {
    return;
  }
  saveSession(deps, { ...session, customer: { ...session.customer, ...patch } });
}

/** Uploaded text is appended under its own heading so source references can name the document. */
function appendDocument(rawText: string, fileName: string, text: string): string {
  const block = `# Uploaded document: ${fileName}\n${text}`;
  return rawText.trim().length === 0 ? block : `${rawText}\n\n${block}`;
}

/**
 * Reads a .txt/.md/.docx/.pdf upload, appends its text to the requirements and records the
 * document. An `IngestionError` (unsupported type, oversize, empty, unreadable, encrypted) becomes
 * an error notice carrying its reviewer-facing message.
 */
export async function addUploadedFile(deps: UseCaseDeps, file: File): Promise<void> {
  if (requireActiveSession(deps) === null) {
    return;
  }
  await runBusy(deps, { label: `Reading ${file.name}...`, stageId: null, errorTitle: 'Upload failed', fallback: undefined }, async () => {
    const { text, info } = await readRequirementsFile(file, deps.now());
    // Nothing was saved before the read finished, so the latest text typed meanwhile is kept.
    const session = findActiveSession(deps.getState());
    if (session === null) {
      return;
    }
    const next = withRequirementsText(session, appendDocument(session.input.rawText, info.name, text));
    saveSession(deps, { ...next, input: { ...next.input, documents: [...next.input.documents, info] } });
    notify(deps, 'success', 'Document added', `"${info.name}" was read (${info.characters.toLocaleString('en-US')} characters) and appended to the requirements text.`);
  });
}
