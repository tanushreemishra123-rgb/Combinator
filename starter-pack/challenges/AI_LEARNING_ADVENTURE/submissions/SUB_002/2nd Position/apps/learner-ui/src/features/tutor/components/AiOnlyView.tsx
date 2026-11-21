import { useMemo, useState, type ReactNode } from 'react';
import type { CatalogDto, MissionDetail, ProgressSnapshotDto } from '@ai-learning-adventure/types';
import { useAppDispatch, useAppSelector } from '../../../store/index.ts';
import { selectAiOnlyRailCollapsed, setAiOnlyRailCollapsed } from '../../../store/aiSlice.ts';
import type { LearnerView } from '../../../store/navigationSlice.ts';
import { useAiOnlySession } from '../hooks/useAiOnlySession.ts';
import { useAiOnlyQuickActions } from '../hooks/useAiOnlyQuickActions.ts';
import { useConversationalWalkthrough } from '../hooks/useConversationalWalkthrough.ts';
import { AiOnlyHeader } from './AiOnlyHeader.tsx';
import { AiOnlyPicker } from './AiOnlyPicker.tsx';
import { AiOnlyQuickActions } from './AiOnlyQuickActions.tsx';
import { AiOnlyScopeRail } from './AiOnlyScopeRail.tsx';
import { AiOnlyScopeSheet } from './AiOnlyScopeSheet.tsx';
import { TutorComposer } from './TutorComposer.tsx';
import { TutorConversation } from './TutorConversation.tsx';
import { WalkthroughTurnCard } from './WalkthroughTurnCard.tsx';

export interface AiOnlyViewProps {
  learnerId: string;
  view: Extract<LearnerView, { kind: 'ai-only' }>;
  catalog: CatalogDto;
  progress: ProgressSnapshotDto;
  navigation?: ReactNode;
}

function scopeLabel(scope: ReturnType<typeof useAiOnlySession>['scope'], catalog: CatalogDto): string {
  if (scope.kind === 'mission') {
    return catalog.missions.find((mission) => mission.id === scope.missionId)?.title ?? 'this mission';
  }
  return 'the mission collection';
}

function MissionWalkthrough({
  learnerId,
  catalog,
  progress,
  mission,
  send,
}: {
  learnerId: string;
  catalog: CatalogDto;
  progress: ProgressSnapshotDto;
  mission: MissionDetail;
  send: ReturnType<typeof useAiOnlySession>['send'];
}) {
  const walkthrough = useConversationalWalkthrough({
    learnerId,
    catalog,
    progress,
    mission,
    send,
  });
  return <WalkthroughTurnCard mission={mission} walkthrough={walkthrough} />;
}

export function AiOnlyView({ learnerId, view, catalog, progress, navigation }: AiOnlyViewProps) {
  const dispatch = useAppDispatch();
  const railCollapsed = useAppSelector(selectAiOnlyRailCollapsed);
  const [scopeSheetOpen, setScopeSheetOpen] = useState(false);
  const session = useAiOnlySession({
    ...(view.missionId !== undefined ? { initialMissionId: view.missionId } : {}),
    catalog,
    progress,
  });
  const lastUserMessage = useMemo(
    () => [...session.messages].reverse().find((message) => message.role === 'user')?.text,
    [session.messages],
  );
  const quickActions = useAiOnlyQuickActions({
    catalog,
    progress,
    projection: session.projection,
    missions: session.missions,
    ...(session.selectedMission !== undefined ? { selectedMission: session.selectedMission } : {}),
    ...(lastUserMessage !== undefined ? { lastUserMessage } : {}),
    busy: session.busy,
    send: session.send,
  });
  const empty = session.messages.length === 0;
  const currentScopeLabel = scopeLabel(session.scope, catalog);

  function sendDraft() {
    const draft = session.draft;
    if (draft.trim().length === 0) return;
    void session.send(draft);
  }

  return (
    <section className={`ai-only-view${railCollapsed ? ' ai-only-view--rail-collapsed' : ''}`} aria-label="AI Only Mode">
      <AiOnlyHeader catalog={catalog} progress={progress} session={session} navigation={navigation} onOpenScope={() => setScopeSheetOpen(true)} />
      <div className="ai-only-layout">
        <AiOnlyScopeRail
          session={session}
          collapsed={railCollapsed}
          onCollapse={() => dispatch(setAiOnlyRailCollapsed(!railCollapsed))}
        />
        <div className="ai-only-main">
          {session.contentError !== undefined ? (
            <div className="ai-only-content-error" role="alert">
              <strong>The learning context could not be loaded.</strong>
              <p>{session.contentError}</p>
              <button type="button" className="button button--secondary button--small" onClick={session.refreshContent}>Try again</button>
            </div>
          ) : session.isLoadingContent ? (
            <div className="ai-only-loading" role="status">Preparing the published mission library…</div>
          ) : (
            <>
              {empty && (
                <div className="ai-only-welcome">
                  <span className="ai-only-welcome__orb" aria-hidden="true">AI</span>
                  <p className="ai-eyebrow">Your learning companion</p>
                  <h2>Where should we begin?</h2>
                  <p>Ask freely within the published missions, or choose a focused way to start.</p>
                  <AiOnlyQuickActions quickActions={quickActions} welcome />
                </div>
              )}
              {session.selectedMission !== undefined && (
                <MissionWalkthrough
                  learnerId={learnerId}
                  catalog={catalog}
                  progress={progress}
                  mission={session.selectedMission}
                  send={session.send}
                />
              )}
              {!empty && (
                <TutorConversation
                  messages={session.messages}
                  catalog={catalog}
                  missionChoices={session.missionChoices}
                  onOpenSource={session.openSource}
                  quickActions={quickActions}
                />
              )}
            </>
          )}
          <div className="ai-only-dock">
            {!empty && <AiOnlyQuickActions quickActions={quickActions} />}
            <TutorComposer
              draft={session.draft}
              busy={session.busy}
              disabled={session.isLoadingContent || session.contentError !== undefined}
              canClear={!empty}
              scopeLabel={currentScopeLabel}
              onDraftChange={session.setDraft}
              onSend={sendDraft}
              onStop={session.stop}
              onClear={session.clearMessages}
            />
            <p className="ai-disclaimer">AI can make mistakes. Answers are grounded in published missions; check important details against the source content.</p>
          </div>
        </div>
      </div>
      <AiOnlyPicker quickActions={quickActions} missions={session.missions} />
      <AiOnlyScopeSheet open={scopeSheetOpen} session={session} onClose={() => setScopeSheetOpen(false)} />
    </section>
  );
}
