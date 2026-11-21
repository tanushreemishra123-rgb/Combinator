import { useRouter } from 'next/router';
import type { NextPage } from 'next';
import { MissionEditorPage } from '@/features/editors/MissionEditorPage';

const MissionDetailPage: NextPage = () => {
  const router = useRouter();
  const id = Array.isArray(router.query.id) ? router.query.id[0] : router.query.id;
  if (id === undefined) return null;
  return <MissionEditorPage id={id} />;
};

export default MissionDetailPage;
