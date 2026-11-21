import type { NextPage } from 'next';
import { InventoryPage } from '@/features/inventory/InventoryPage';

const FlashcardsPage: NextPage = () => <InventoryPage entityType="flashcard" />;

export default FlashcardsPage;
