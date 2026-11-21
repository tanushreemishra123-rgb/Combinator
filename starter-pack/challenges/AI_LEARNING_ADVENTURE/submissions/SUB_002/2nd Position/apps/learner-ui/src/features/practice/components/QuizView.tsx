import type { CatalogDto, ProgressSnapshotDto } from '@ai-learning-adventure/types';
import { useQuizSession, type QuizViewType } from '../hooks/useQuizSession.ts';
import { useAppNavigation } from '../../../hooks/useAppNavigation.ts';
import { QuizRunner } from './QuizRunner.tsx';
import { QuizResults } from './QuizResults.tsx';

export interface QuizViewProps {
  learnerId: string;
  view: QuizViewType;
  catalog: CatalogDto;
  progress: ProgressSnapshotDto;
}

export function QuizView({ learnerId, view, catalog, progress }: QuizViewProps) {
  const { back } = useAppNavigation();
  const session = useQuizSession(learnerId, view, progress);

  if (session.error !== undefined) {
    return (
      <div className="app-status" role="alert">
        <h1>This quiz could not be loaded</h1>
        <p>{session.error.message}</p>
        <div>
          <button type="button" className="app-status__retry" onClick={session.refresh}>
            Try again
          </button>
          <button type="button" className="button button--ghost" onClick={back}>
            Back to map
          </button>
        </div>
      </div>
    );
  }

  if (session.isLoading || session.mission === undefined || session.status === undefined) {
    return (
      <div className="app-status" role="status">
        <p>Loading quiz…</p>
      </div>
    );
  }

  if (session.status === 'finalized') {
    return (
      <QuizResults
        mission={session.mission}
        catalog={catalog}
        progress={progress}
        session={session}
      />
    );
  }

  return <QuizRunner mission={session.mission} session={session} />;
}
