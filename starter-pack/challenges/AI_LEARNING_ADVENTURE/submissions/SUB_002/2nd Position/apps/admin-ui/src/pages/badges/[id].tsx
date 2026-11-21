import { useRouter } from 'next/router';
import type { NextPage } from 'next';
import { AwardEditorPage } from '@/features/editors/AwardEditorPage';

const BadgeDetailPage: NextPage = () => {
  const router = useRouter();
  const id = Array.isArray(router.query.id) ? router.query.id[0] : router.query.id;
  if (id === undefined) return null;
  return <AwardEditorPage id={id} />;
};

export default BadgeDetailPage;
