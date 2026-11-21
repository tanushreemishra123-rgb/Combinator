/** Step 1: "Understand the customer need" (spec Core User Journey steps 1-4). */
import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import type { ScopingSession } from '../../../domain';
import { SEED_SCENARIOS } from '../../../seed';
import { selectInputIssues, selectNormalizedPreview, useActions, useAppState, useBusy } from '../../../state';
import { describeAnalysisPath } from '../analysisPath';
import { CustomerContextCard } from './CustomerContextCard';
import { NormalizedPreview } from './NormalizedPreview';
import { ReplaceScopeModal } from './ReplaceScopeModal';
import { RequirementsInputPanel } from './RequirementsInputPanel';
import { ScenarioPicker } from './ScenarioPicker';

export interface UnderstandStepProps {
  session: ScopingSession;
}

export function UnderstandStep({ session }: UnderstandStepProps): ReactElement {
  const actions = useActions();
  const busy = useBusy();
  const { aiSettings } = useAppState();
  const [confirmingReplace, setConfirmingReplace] = useState(false);

  const issues = useMemo(() => selectInputIssues(session), [session]);
  const preview = useMemo(() => selectNormalizedPreview(session), [session]);
  const analysisPath = useMemo(
    () => describeAnalysisPath(aiSettings, session.input.rawText, session.input.scenarioId),
    [aiSettings, session.input.rawText, session.input.scenarioId],
  );

  // A reviewed scope already exists: ask before a new run replaces it and every deliverable.
  function handleRunAnalysis(): void {
    if (session.scope === null) {
      void actions.runAnalysis();
      return;
    }
    setConfirmingReplace(true);
  }

  function handleConfirmReplace(): void {
    setConfirmingReplace(false);
    void actions.runAnalysis();
  }

  function handleUploadFiles(files: File[]): void {
    files.forEach((file) => {
      void actions.addUploadedFile(file);
    });
  }

  return (
    <div className="stack stack-lg">
      <CustomerContextCard customer={session.customer} onChange={(patch) => actions.setCustomerContext(patch)} />
      <ScenarioPicker scenarios={SEED_SCENARIOS} activeScenarioId={session.input.scenarioId} onLoad={(id) => actions.createSessionFromScenario(id)} />
      <div className="requirements-input-grid">
        <RequirementsInputPanel
          rawText={session.input.rawText}
          onChangeText={(text) => actions.setRequirementsText(text)}
          issues={issues}
          documents={session.input.documents}
          uploading={busy !== null}
          onFiles={handleUploadFiles}
          analysisPath={analysisPath}
          isAnalyzing={busy !== null}
          onRunAnalysis={handleRunAnalysis}
        />
        <NormalizedPreview preview={preview} />
      </div>
      <ReplaceScopeModal scope={session.scope} open={confirmingReplace} onCancel={() => setConfirmingReplace(false)} onConfirm={handleConfirmReplace} />
    </div>
  );
}
