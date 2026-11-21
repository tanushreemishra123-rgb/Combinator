import { useEffect } from 'react';
import { useRouter } from 'next/router';
import type { NextPage } from 'next';

const AdminIndex: NextPage = () => {
  const router = useRouter();
  useEffect(() => {
    void router.replace('/missions');
  }, [router]);
  return null;
};

export default AdminIndex;
