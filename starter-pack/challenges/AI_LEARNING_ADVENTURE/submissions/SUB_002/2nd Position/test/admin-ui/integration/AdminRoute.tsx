import { InventoryPage } from '@/features/inventory/InventoryPage';
import { MissionEditorPage } from '@/features/editors/MissionEditorPage';
import { QuestionEditorPage } from '@/features/editors/QuestionEditorPage';
import { FlashcardEditorPage } from '@/features/editors/FlashcardEditorPage';
import { AwardEditorPage } from '@/features/editors/AwardEditorPage';
import { AssignmentBoard } from '@/features/assignments/AssignmentBoard';
import { CurriculumPage } from '@/features/curriculum/CurriculumPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { useTestRouter } from './helpers/router.tsx';

function routeId(pathname: string, base: string): string | undefined {
  const prefix = `/${base}/`;
  if (!pathname.startsWith(prefix)) return undefined;
  const rest = pathname.slice(prefix.length);
  if (rest.length === 0 || rest.includes('/')) return undefined;
  return decodeURIComponent(rest);
}

export function AdminRoute() {
  const router = useTestRouter();
  const { pathname } = router;

  if (pathname === '/' || pathname === '/missions') return <InventoryPage entityType="mission" />;
  if (pathname === '/missions/assignments') return <AssignmentBoard />;
  if (pathname === '/questions') return <InventoryPage entityType="question" />;
  if (pathname === '/flashcards') return <InventoryPage entityType="flashcard" />;
  if (pathname === '/badges') return <InventoryPage entityType="award" />;
  if (pathname === '/curriculum') return <CurriculumPage />;
  if (pathname === '/settings') return <SettingsPage />;

  const missionId = routeId(pathname, 'missions');
  if (missionId !== undefined) return <MissionEditorPage id={missionId} />;
  const questionId = routeId(pathname, 'questions');
  if (questionId !== undefined) return <QuestionEditorPage id={questionId} />;
  const flashcardId = routeId(pathname, 'flashcards');
  if (flashcardId !== undefined) return <FlashcardEditorPage id={flashcardId} />;
  const awardId = routeId(pathname, 'badges');
  if (awardId !== undefined) return <AwardEditorPage id={awardId} />;

  return <h1>Unknown admin route</h1>;
}
