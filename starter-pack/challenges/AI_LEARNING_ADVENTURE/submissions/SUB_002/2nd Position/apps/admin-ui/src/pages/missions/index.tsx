import type { NextPage } from 'next';
import { InventoryPage } from '@/features/inventory/InventoryPage';

const MissionsPage: NextPage = () => <InventoryPage entityType="mission" />;

export default MissionsPage;
