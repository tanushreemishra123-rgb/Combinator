/**
 * Top app bar: the editable session name, a persistent AI-mode badge (spec's clear labelling
 * requirement for AI-generated content applies to the mode itself, not only individual outputs),
 * a busy indicator, and buttons to open the sessions list and AI settings.
 */
import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import { Badge, Button, IconButton, Spinner, TextInput } from '../common';
import { FolderIcon, SettingsIcon } from '../common/icons';

export interface HeaderBarProps {
  sessionName: string;
  onRename: (name: string) => void;
  aiModeLabel: string;
  isMockMode: boolean;
  onOpenSettings: () => void;
  onOpenSessions: () => void;
  busyLabel?: string;
}

export function HeaderBar({
  sessionName,
  onRename,
  aiModeLabel,
  isMockMode,
  onOpenSettings,
  onOpenSessions,
  busyLabel,
}: HeaderBarProps): ReactElement {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(sessionName);

  function startEditing(): void {
    setDraftName(sessionName);
    setEditing(true);
  }

  function commitRename(event: FormEvent): void {
    event.preventDefault();
    const trimmed = draftName.trim();
    if (trimmed.length > 0 && trimmed !== sessionName) {
      onRename(trimmed);
    }
    setEditing(false);
  }

  return (
    <header className="header-bar">
      <div className="header-bar-identity">
        {editing ? (
          <form className="header-bar-rename-form" onSubmit={commitRename}>
            <TextInput
              value={draftName}
              onChange={setDraftName}
              aria-describedby="header-bar-rename-hint"
              autoComplete="off"
            />
            <span id="header-bar-rename-hint" className="sr-only">
              Session name
            </span>
            <Button type="submit" variant="secondary" size="sm">
              Save
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </form>
        ) : (
          <button type="button" className="header-bar-session-name" onClick={startEditing}>
            {sessionName}
          </button>
        )}
        <Badge tone={isMockMode ? 'neutral' : 'success'} className="header-bar-ai-mode">
          {aiModeLabel}
        </Badge>
      </div>
      <div className="header-bar-actions">
        {busyLabel ? (
          <span className="header-bar-busy" role="status" aria-live="polite">
            <Spinner size="sm" label={busyLabel} />
            <span>{busyLabel}</span>
          </span>
        ) : null}
        <Button variant="secondary" size="sm" icon={<FolderIcon />} onClick={onOpenSessions}>
          Sessions
        </Button>
        <IconButton label="AI settings" icon={<SettingsIcon />} variant="secondary" onClick={onOpenSettings} />
      </div>
    </header>
  );
}
