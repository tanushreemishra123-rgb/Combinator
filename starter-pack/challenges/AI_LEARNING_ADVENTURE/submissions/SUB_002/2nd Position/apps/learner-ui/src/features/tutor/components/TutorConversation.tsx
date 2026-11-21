import { useEffect, useMemo, useRef } from 'react';
import type { CatalogDto, MissionId } from '@ai-learning-adventure/types';
import type { AiMessage } from '../../../store/aiSlice.ts';
import type { AiOnlyMissionChoice } from '../hooks/useAiOnlySession.ts';
import type { UseAiOnlyQuickActionsResult } from '../hooks/useAiOnlyQuickActions.ts';
import { AiMockNotice } from '../../ai-provider/components/AiMockNotice.tsx';
import { AiRequestErrorCard } from '../../ai-provider/components/AiRequestErrorCard.tsx';

export interface TutorConversationProps {
  messages: AiMessage[];
  catalog: CatalogDto;
  missionChoices?: AiOnlyMissionChoice[];
  onOpenSource: (missionId: MissionId) => void;
  quickActions: UseAiOnlyQuickActionsResult;
}

function MessageText({ text }: { text: string }) {
  const lines = text.split('\n');
  const listItems = lines.filter((line) => /^\s*[-*]\s+/.test(line));
  if (listItems.length === lines.filter((line) => line.trim().length > 0).length && listItems.length > 0) {
    return <ul className="ai-message__list">{listItems.map((line, index) => <li key={`${index}-${line}`}>{line.replace(/^\s*[-*]\s+/, '')}</li>)}</ul>;
  }
  return <p className="ai-message__text">{text || 'Thinking…'}</p>;
}

function StructuredReply({
  message,
  catalog,
  onOpenSource,
  quickActions,
}: {
  message: AiMessage;
  catalog: CatalogDto;
  onOpenSource: (missionId: MissionId) => void;
  quickActions: UseAiOnlyQuickActionsResult;
}) {
  const structured = message.structured;
  if (structured === undefined) return <MessageText text={message.text} />;
  if (structured.kind === 'summary') {
    return (
      <div className="ai-structured-card">
        <h3>{structured.summary.title}</h3>
        <ul>{structured.summary.items.map((item) => <li key={item.text}>{item.text}</li>)}</ul>
        <div className="ai-structured-card__actions">
          <button type="button" className="button button--ghost button--small" onClick={() => quickActions.addSummaryToReview(structured)}>
            Add to review
          </button>
        </div>
      </div>
    );
  }
  if (structured.kind === 'written_feedback') {
    return (
      <div className="ai-written-feedback ai-structured-card">
        <div><strong>What you got right</strong><p>{structured.feedback.strengths}</p></div>
        <div><strong>What's missing</strong><p>{structured.feedback.missing}</p></div>
        <div><strong>One improvement</strong><p>{structured.feedback.improvement}</p></div>
        <div><strong>Encouragement</strong><p>{structured.feedback.encouragement}</p></div>
        <button type="button" className="button button--ghost button--small" onClick={quickActions.reviseLastAnswer}>
          Revise and resubmit
        </button>
      </div>
    );
  }
  const recommendation = structured.recommendation;
  return (
    <div className="ai-recommendation-card">
      <p className="ai-eyebrow">Progress-aware next step</p>
      {recommendation.kind === 'mission' ? (
        <>
          <h3>{recommendation.title}</h3>
          <p>{recommendation.reason}</p>
          <button type="button" className="button button--primary button--small" onClick={() => onOpenSource(recommendation.missionId)}>
            Start mission
          </button>
        </>
      ) : recommendation.kind === 'review' ? (
        <><h3>Review {recommendation.topic}</h3><p>{recommendation.reason}</p></>
      ) : (
        <><h3>Journey complete</h3><p>{recommendation.reason}</p></>
      )}
    </div>
  );
}

export function TutorConversation({
  messages,
  catalog,
  missionChoices,
  onOpenSource,
  quickActions,
}: TutorConversationProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const choiceMap = useMemo(
    () => new Map((missionChoices ?? []).map((choice) => [choice.id, choice])),
    [missionChoices],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'auto' });
  }, [messages]);

  return (
    <div className="ai-only-conversation" role="log" aria-label="AI learning conversation" aria-live="off">
      {messages.map((message) => {
        const sources = message.sourceMissionIds.flatMap((missionId) => {
          const mission = catalog.missions.find((candidate) => candidate.id === missionId);
          return mission === undefined ? [] : [mission];
        });
        return (
          <article key={message.id} className={`ai-message ai-message--${message.role}${message.isMock ? ' ai-message--mock' : ''}`} aria-label={message.role === 'assistant' ? 'AI tutor message' : 'Your message'}>
            <p className="ai-message__role">{message.role === 'assistant' ? 'AI guide' : 'You'}</p>
            {message.providerError !== undefined && <AiRequestErrorCard error={message.providerError} />}
            {message.role === 'assistant' ? (
              <StructuredReply message={message} catalog={catalog} onOpenSource={onOpenSource} quickActions={quickActions} />
            ) : (
              <MessageText text={message.text} />
            )}
            {message.isMock && <AiMockNotice />}
            {message.status === 'pending' && <p className="ai-message__meta">Thinking…</p>}
            {message.status === 'stopped' && <p className="ai-message__meta">Response stopped.</p>}
            {message.status === 'error' && <p className="ai-message__error" role="alert">{message.error ?? 'The response failed.'}</p>}
            {message.safety?.redirected && <p className="ai-message__meta">This reply stays within the published learning content.</p>}
            {message.safety?.uncertain && <p className="ai-message__meta">I'm not certain about everything here. Check the mission source.</p>}
            {sources.length > 0 && (
              <div className="ai-message__sources" aria-label="Sources">
                <span>Sources</span>
                {sources.map((mission) => {
                  const choice = choiceMap.get(mission.id);
                  const isLocked = choice?.locked ?? false;
                  const lockTitle =
                    isLocked && choice?.prerequisiteTitle !== undefined
                      ? `Complete "${choice.prerequisiteTitle}" first`
                      : isLocked
                      ? 'Locked'
                      : undefined;
                  return (
                    <button
                      key={mission.id}
                      id={`ai-source-${message.id}-${mission.id}`}
                      type="button"
                      className={`ai-source-chip${isLocked ? ' ai-source-chip--locked' : ''}`}
                      disabled={isLocked}
                      title={lockTitle}
                      aria-disabled={isLocked || undefined}
                      onClick={() => {
                        if (!isLocked) onOpenSource(mission.id);
                      }}
                    >
                      {mission.title} <span aria-hidden="true">{isLocked ? '🔒' : '↗'}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </article>
        );
      })}
      <div ref={endRef} className="ai-only-conversation__end" aria-hidden="true" />
    </div>
  );
}
