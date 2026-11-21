import { useRouter } from 'next/router';
import type { NextPage } from 'next';
import { QuestionEditorPage } from '@/features/editors/QuestionEditorPage';

const QuestionDetailPage: NextPage = () => {
  const router = useRouter();
  const id = Array.isArray(router.query.id) ? router.query.id[0] : router.query.id;
  if (id === undefined) return null;
  return <QuestionEditorPage id={id} />;
};

export default QuestionDetailPage;
