import type { AdminLifecycleStatus } from '@ai-learning-adventure/types';
import { Badge } from '@/components/ui';
import { STATUS_LABELS } from '@/lib/labels';

const STATUS_VARIANTS: Record<AdminLifecycleStatus, 'draft' | 'published' | 'warning'> = {
  draft: 'draft',
  published: 'published',
  published_changed: 'warning',
};

export function StatusBadge({ status, enabled }: { status: AdminLifecycleStatus; enabled: boolean }) {
  if (!enabled) {
    return <Badge variant="disabled">Disabled</Badge>;
  }
  return <Badge variant={STATUS_VARIANTS[status] /* nosemgrep: gitlab.eslint.detect-object-injection */}>{STATUS_LABELS[status]}</Badge>;
}
