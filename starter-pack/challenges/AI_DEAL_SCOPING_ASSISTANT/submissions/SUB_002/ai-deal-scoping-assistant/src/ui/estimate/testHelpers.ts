/**
 * Shared test doubles for the Estimate Workspace's component tests. `createActionsMock` stubs
 * every `BoundUseCases` method so a test only has to override the handful it actually exercises,
 * and every state hook is mocked at the module boundary (`vi.mock('../../state')` in each test
 * file) so these tests never depend on that module's own runtime behaviour.
 */
import { vi } from 'vitest';
import type { BoundUseCases } from '../../state';

export function createActionsMock(): BoundUseCases {
  return {
    createNewSession: vi.fn(),
    createSessionFromScenario: vi.fn(),
    renameSession: vi.fn(),
    selectSession: vi.fn(),
    deleteSession: vi.fn(),
    deleteAllData: vi.fn(),
    importSession: vi.fn(),
    exportWorkspace: vi.fn(),
    setRequirementsText: vi.fn(),
    setCustomerContext: vi.fn(),
    addUploadedFile: vi.fn().mockResolvedValue(undefined),
    runAnalysis: vi.fn().mockResolvedValue(undefined),
    editScopeItem: vi.fn().mockResolvedValue(undefined),
    addScopeItem: vi.fn().mockResolvedValue(undefined),
    removeScopeItem: vi.fn().mockResolvedValue(undefined),
    setItemReview: vi.fn().mockResolvedValue(undefined),
    approveAllPending: vi.fn().mockResolvedValue(undefined),
    resolveScopeItem: vi.fn().mockResolvedValue(undefined),
    reopenScopeItem: vi.fn().mockResolvedValue(undefined),
    approveScope: vi.fn(),
    updateSolutionConfig: vi.fn().mockResolvedValue(undefined),
    updateEstimationConfig: vi.fn().mockResolvedValue(undefined),
    setRoleRate: vi.fn().mockResolvedValue(undefined),
    applyCommercialPreset: vi.fn().mockResolvedValue(undefined),
    setDriverComplexity: vi.fn().mockResolvedValue(undefined),
    previewChange: vi.fn().mockResolvedValue({ changes: [], reports: [] }),
    applyChange: vi.fn().mockResolvedValue({ changes: [], reports: [] }),
    generateStage: vi.fn().mockResolvedValue(undefined),
    generateAll: vi.fn().mockResolvedValue(undefined),
    regenerateStale: vi.fn().mockResolvedValue(undefined),
    setStageReviewed: vi.fn(),
    runQuality: vi.fn(),
    refreshExecutiveSummary: vi.fn().mockResolvedValue(undefined),
    exportPackage: vi.fn().mockResolvedValue(null),
    updateAiSettings: vi.fn(),
    runConnectionTest: vi.fn().mockResolvedValue({ ok: true, message: 'Connected.' }),
    dismissNotice: vi.fn(),
    clearNotices: vi.fn(),
  };
}
