import { EXPORT_DISCLAIMER } from '../domain';
import { parseSession } from '../state/sessionSchema';
import { fixtureSession } from '../test/fixtures';
import { toWorkspaceJson } from './workspaceJson';

describe('toWorkspaceJson', () => {
  it('produces valid, pretty-printed JSON that round-trips the session', () => {
    const session = fixtureSession();
    const json = toWorkspaceJson(session);
    expect(json).toContain('\n');
    expect(JSON.parse(json)).toEqual({ disclaimer: EXPORT_DISCLAIMER, ...JSON.parse(JSON.stringify(session)) });
  });

  it('carries the mandatory export disclaimer, like every other export format', () => {
    const json = toWorkspaceJson(fixtureSession());
    expect(JSON.parse(json).disclaimer).toBe(EXPORT_DISCLAIMER);
  });

  it('never contains an API key field, by construction of ScopingSession', () => {
    const json = toWorkspaceJson(fixtureSession());
    expect(json.toLowerCase()).not.toContain('apikey');
  });

  it('still imports as a valid session once the disclaimer field is added', () => {
    const session = fixtureSession();
    const json = toWorkspaceJson(session);
    const result = parseSession(JSON.parse(json), session.updatedAt);
    expect(result.ok).toBe(true);
  });
});
