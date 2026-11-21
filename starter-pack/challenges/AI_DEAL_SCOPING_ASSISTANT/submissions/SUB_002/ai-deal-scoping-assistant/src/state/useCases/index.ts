/**
 * Use-case barrel: every action the UI can take, as plain functions of `UseCaseDeps` (testable
 * without React). `store.tsx` binds them to the live store as `useActions()`.
 */
export { updateAiSettings, runConnectionTest } from './aiSettings';
export { runAnalysis } from './analysis';
export { applyChange, previewChange } from './changeFlow';
export { applyCommercialPreset, setDriverComplexity, setRoleRate, updateEstimationConfig, updateSolutionConfig } from './config';
export { generateAll, generateStage, regenerateStale, setStageReviewed } from './generation';
export { addUploadedFile, setCustomerContext, setRequirementsText } from './input';
export { clearNotices, dismissNotice } from './notices';
export { exportPackage, exportWorkspace, refreshExecutiveSummary } from './packageExport';
export { runQuality } from './quality';
export {
  addScopeItem,
  approveAllPending,
  approveScope,
  editScopeItem,
  removeScopeItem,
  reopenScopeItem,
  resolveScopeItem,
  setItemReview,
} from './scopeEdits';
export {
  createNewSession,
  createSessionFromScenario,
  deleteAllData,
  deleteSession,
  importSession,
  renameSession,
  selectSession,
} from './sessions';
