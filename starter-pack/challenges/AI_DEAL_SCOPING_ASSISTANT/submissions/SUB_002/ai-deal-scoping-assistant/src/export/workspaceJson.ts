/**
 * Session workspace export (spec 6): a pretty-printed JSON snapshot of the whole session - inputs,
 * reviewed scope, configuration and every generated output - for backup or hand-off between
 * reviewers. `ScopingSession` (src/domain/session.ts) never carries an API key or other secret, so
 * no redaction is needed before serialising it. The mandatory export disclaimer is stamped as a
 * leading `disclaimer` field so this format carries it like every other export; `PersistedScopingSessionSchema`
 * is a plain `z.object`, which strips unknown keys by default, so re-importing the file still works.
 */
import { EXPORT_DISCLAIMER } from '../domain';
import type { ScopingSession } from '../domain';

export function toWorkspaceJson(session: ScopingSession): string {
  return JSON.stringify({ disclaimer: EXPORT_DISCLAIMER, ...session }, null, 2);
}
