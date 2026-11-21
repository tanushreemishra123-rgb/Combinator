import { useRouter } from 'next/router';
import type { NextPage } from 'next';
import { FlashcardEditorPage } from '@/features/editors/FlashcardEditorPage';

const FlashcardDetailPage: NextPage = () => {
  const router = useRouter();
  const id = Array.isArray(router.query.id) ? router.query.id[0] : router.query.id;
  if (id === undefined) return null;
  return <FlashcardEditorPage id={id} />;
};

export default FlashcardDetailPage;
