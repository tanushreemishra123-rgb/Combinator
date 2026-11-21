import { useStore } from '../state/store';
import { LIVE_MODELS } from '../providers/live';
import { Dialog } from './Dialog';

export function SettingsModal() {
  const open = useStore((s) => s.settingsOpen);
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);

  if (!open) return null;

  return (
    <Dialog titleId="settings-title" onClose={() => setSettingsOpen(false)}>
      <h3 id="settings-title">⚙️ Settings</h3>

        <h4>🧪 Mock AI mode (default)</h4>
        <p className="muted small">
          All model, tool, and retrieval calls are deterministic local mocks committed with the puzzles. Nothing leaves your machine, no
          keys or paid access are needed, and every failure scenario reproduces identically on every run.
        </p>

        <h4>⚡ Optional live AI provider</h4>
        <p className="muted small">
          With an Anthropic API key, AI steps call the real model; tools, retrieval, and failure injection stay local so puzzles remain
          reproducible. Scripted model failure scenarios apply to mock mode only.
        </p>
        <div className="security-note">
          <strong>🔒 Where your key goes.</strong> This app has no backend, so a key you enter here is kept in this
          browser&rsquo;s <code>localStorage</code> and sent directly to <code>api.anthropic.com</code> — nowhere else, and
          never to us. It is never logged, never bundled, and never leaves this machine except in that one request.
          Nothing in the challenge requires live mode; leave it off and everything still works.
          {' '}Use a scoped key you can revoke, and clear it when you are done.
        </div>
        <label className="field">
          <span className="field-label">Enable live AI for AI steps</span>
          <input type="checkbox" checked={settings.liveEnabled} onChange={(e) => updateSettings({ liveEnabled: e.target.checked })} />
        </label>
        {settings.liveEnabled && (
          <>
            <label className="field">
              <span className="field-label">Anthropic API key</span>
              <input
                type="password"
                value={settings.apiKey}
                placeholder="sk-ant-…"
                onChange={(e) => updateSettings({ apiKey: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="field-label">Model</span>
              <select value={settings.model} onChange={(e) => updateSettings({ model: e.target.value })}>
                {LIVE_MODELS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        <div className="modal-actions">
          <button type="button" onClick={() => setSettingsOpen(false)}>
            Done
          </button>
          {settings.apiKey.length > 0 && (
            <button
              type="button"
              className="btn-reject"
              onClick={() => updateSettings({ apiKey: '', liveEnabled: false })}
            >
              🧹 Clear stored key
            </button>
          )}
        </div>
    </Dialog>
  );
}
