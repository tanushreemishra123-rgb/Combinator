import { useLiveAnnouncement } from '../hooks/ui/useLiveAnnouncement.ts';

export function LiveRegion() {
  const { announcement } = useLiveAnnouncement();
  return (
    <div
      className="visually-hidden"
      role="status"
      aria-live={announcement?.politeness ?? 'polite'}
      aria-atomic="true"
    >
      {announcement?.message ?? ''}
    </div>
  );
}
