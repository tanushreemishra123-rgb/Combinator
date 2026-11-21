/**
 * Shared test doubles for this workspace's component tests. Not imported by any production code -
 * every exported name here exists only so `*.test.tsx` files can `vi.mock('.../state')` without
 * repeating the full `BoundUseCases` shape in every file.
 */
import { vi } from 'vitest';
import { defaultAiSettings } from '../../ai';
import type { AppState } from '../../state';
import type { BoundUseCases } from '../../state';

/** A `BoundUseCases` double where every action is a `vi.fn()`; pass `overrides` for the ones a test asserts on. */
export function createActionsMock(overrides: Partial<BoundUseCases> = {}): BoundUseCases {
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
    addUploadedFile: vi.fn(),
    runAnalysis: vi.fn(),
    editScopeItem: vi.fn(),
    addScopeItem: vi.fn(),
    removeScopeItem: vi.fn(),
    setItemReview: vi.fn(),
    approveAllPending: vi.fn(),
    resolveScopeItem: vi.fn(),
    reopenScopeItem: vi.fn(),
    approveScope: vi.fn(),
    updateSolutionConfig: vi.fn(),
    updateEstimationConfig: vi.fn(),
    setRoleRate: vi.fn(),
    applyCommercialPreset: vi.fn(),
    setDriverComplexity: vi.fn(),
    previewChange: vi.fn().mockResolvedValue({ changes: [], reports: [] }),
    applyChange: vi.fn().mockResolvedValue({ changes: [], reports: [] }),
    generateStage: vi.fn(),
    generateAll: vi.fn(),
    regenerateStale: vi.fn(),
    setStageReviewed: vi.fn(),
    runQuality: vi.fn(),
    refreshExecutiveSummary: vi.fn(),
    exportPackage: vi.fn().mockResolvedValue(null),
    updateAiSettings: vi.fn(),
    runConnectionTest: vi.fn().mockResolvedValue({ ok: true, message: '' }),
    dismissNotice: vi.fn(),
    clearNotices: vi.fn(),
    ...overrides,
  };
}

/** A minimal `AppState` double; pass `overrides` for the fields a test reads (usually `aiSettings`). */
export function createAppStateMock(overrides: Partial<AppState> = {}): AppState {
  return {
    sessions: [],
    activeSessionId: null,
    aiSettings: defaultAiSettings(),
    busy: null,
    notices: [],
    ...overrides,
  };
}
