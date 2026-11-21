import type { NextPage } from 'next';
import { InventoryPage } from '@/features/inventory/InventoryPage';

const BadgesPage: NextPage = () => <InventoryPage entityType="award" />;

export default BadgesPage;
