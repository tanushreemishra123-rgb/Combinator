/**
 * Root of the Customer Requirements Workspace (spec "Recommended Application Sections 1"). Takes
 * no props: reads the active session and every action through the state hooks, and is the single
 * place that decides which of the four spec-named steps is showing.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import type { ScopeModel } from '../../domain';
import { SEED_SCENARIOS } from '../../seed';
import { useActions, useActiveSession, useBusy } from '../../state';
import { Button, Card, EmptyState, SectionHeader, Tabs } from '../common';
import { useWorkspaceNavigation } from '../navigation';
import { ApproveStep } from './steps/ApproveStep';
import { ClarifyStep } from './steps/ClarifyStep';
import { ReviewScopeStep } from './steps/ReviewScopeStep';
import { ScenarioPicker } from './steps/ScenarioPicker';
import { UnderstandStep } from './steps/UnderstandStep';
import { REQUIREMENTS_STEPS } from './types';
import type { RequirementsStepId } from './types';
import './RequirementsWorkspace.css';

/** Busy `stageId` set only while "Run AI-assisted requirement analysis" is in flight (see `runAnalysis`). */
const ANALYSIS_STAGE_ID = 'analysis';

/**
 * True exactly once: the render where "Run AI-assisted requirement analysis" has just finished and
 * produced a genuinely new scope model (the null/previous-version -> new analysis transition), while
 * the "Understand the customer need" step was still showing. Tracked as the busy flag flipping from
 * analyzing to idle (computed during render, like `lastFocusId` below) rather than in an effect, so it
 * fires once per completed analysis and never again for an ordinary re-render or a later tab visit.
 */
function useAnalysisJustCompleted(currentScope: ScopeModel | null, activeStep: RequirementsStepId): boolean {
  const busy = useBusy();
  const [wasAnalyzing, setWasAnalyzing] = useState(false);
  const [scopeBeforeAnalysis, setScopeBeforeAnalysis] = useState<ScopeModel | null>(null);
  const isAnalyzing = busy?.stageId === ANALYSIS_STAGE_ID;

  if (isAnalyzing === wasAnalyzing) {
    return false;
  }
  setWasAnalyzing(isAnalyzing);
  if (isAnalyzing) {
    setScopeBeforeAnalysis(currentScope);
    return false;
  }
  return activeStep === 'understand' && currentScope !== null && currentScope !== scopeBeforeAnalysis;
}

function NoActiveSession(): ReactElement {
  const actions = useActions();
  return (
    <div className="stack stack-lg">
      <EmptyState
        title="No scoping session selected"
        message="Create a new solution-scoping session to start the customer requirements workspace (spec Core User Journey, step 1)."
        action={
          <Button variant="primary" onClick={() => actions.createNewSession('New scoping session')}>
            Start a blank session
          </Button>
        }
      />
      <ScenarioPicker scenarios={SEED_SCENARIOS} activeScenarioId={null} onLoad={(id) => actions.createSessionFromScenario(id)} />
    </div>
  );
}

export function RequirementsWorkspace(): ReactElement {
  const session = useActiveSession();
  const hasScope = session !== null && session.scope !== null;
  const { activeWorkspace, focusId, clearFocus } = useWorkspaceNavigation();
  // A session that already has a scope model opens on its review step, so coming back from another
  // workspace (or reloading the page) never drops the reviewer back onto the raw requirements input.
  const [activeStep, setActiveStep] = useState<RequirementsStepId>(() => (hasScope ? 'review' : 'understand'));
  const [lastFocusId, setLastFocusId] = useState<string | null>(null);

  const handleFocusHandled = useCallback(() => clearFocus(), [clearFocus]);

  // Switches to "Review the extracted scope" whenever a new cross-workspace focus request arrives,
  // computed during render (React's documented "adjust state on prop change" pattern) rather than
  // in an effect - it only reacts to a genuinely new focusId, not every re-render.
  if (focusId !== lastFocusId) {
    setLastFocusId(focusId);
    if (activeWorkspace === 'requirements' && focusId !== null) {
      setActiveStep('review');
    }
  }

  if (useAnalysisJustCompleted(session?.scope ?? null, activeStep)) {
    setActiveStep('review');
  }

  // A step swaps the whole panel, so without this the next step opens at the previous step's scroll
  // offset - most visibly right after an analysis, which switches to the review step on its own. A
  // step change that came with a focus request is left alone: that step scrolls its own target into
  // view.
  const previousStep = useRef(activeStep);
  useEffect(() => {
    if (previousStep.current === activeStep) {
      return;
    }
    previousStep.current = activeStep;
    if (focusId === null) {
      window.scrollTo(0, 0);
    }
  }, [activeStep, focusId]);

  if (session === null) {
    return (
      <div className="stack stack-lg">
        <SectionHeader eyebrow="Customer Requirements Workspace" title="Understand the customer need" as="h1" />
        <NoActiveSession />
      </div>
    );
  }

  return (
    <div className="stack stack-lg">
      <SectionHeader
        eyebrow="Customer Requirements Workspace"
        title={REQUIREMENTS_STEPS.find((step) => step.id === activeStep)?.label ?? 'Customer Requirements Workspace'}
        description={session.name}
        as="h1"
      />
      <Card padded={false}>
        <Tabs
          items={REQUIREMENTS_STEPS.map((step) => ({ id: step.id, label: step.label }))}
          activeId={activeStep}
          ariaLabel="Customer Requirements Workspace steps"
          onChange={(id) => setActiveStep(id as RequirementsStepId)}
        >
          {(id) => (
            <div className="requirements-step-panel">
              {id === 'understand' ? <UnderstandStep session={session} /> : null}
              {id === 'review' ? <ReviewScopeStep session={session} focusItemId={focusId} onFocusHandled={handleFocusHandled} /> : null}
              {id === 'clarify' ? <ClarifyStep session={session} /> : null}
              {id === 'approve' ? <ApproveStep session={session} /> : null}
            </div>
          )}
        </Tabs>
      </Card>
    </div>
  );
}
