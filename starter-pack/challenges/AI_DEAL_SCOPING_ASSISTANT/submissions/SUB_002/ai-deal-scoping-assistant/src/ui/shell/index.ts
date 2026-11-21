/**
 * The presentational application shell: layout, navigation and the session/AI-settings dialogs.
 * Nothing here depends on `src/state` - everything is driven through props, and the state layer
 * wires it up.
 */
export * from './workspaces';
export * from './useHashRoute';
export * from './Sidebar';
export * from './HeaderBar';
export * from './WorkspaceFooterNav';
export * from './AiSettingsDialog';
export * from './SessionsDialog';
export * from './AppLayout';
