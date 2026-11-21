/**
 * Wires the shell's `NoticeStack` to the notice list in `AppState`. The two tone vocabularies differ
 * by one name (state's `'error'` vs the design system's `'danger'`), so this is also where that gets
 * translated - the only place either name needs to be known.
 *
 * This container also owns the toast stack's lifecycle policy: it keeps at most `MAX_VISIBLE_NOTICES`
 * on screen (dismissing the oldest overflow through the same `dismissNotice` use case a person's click
 * would use) and auto-dismisses success/info/warning notices after a tone-specific delay - errors stay
 * until dismissed by hand. Both behaviours dispatch through `dismissNotice`, so the visible stack and
 * `AppState.notices` never disagree about what is still showing.
 */
import { useEffect, useRef } from 'react';
import type { ReactElement } from 'react';
import { useActions, useAppState } from '../../state';
import type { Notice, NoticeTone } from '../../state';
import { NoticeStack } from '../../ui/common';
import type { CalloutTone } from '../../ui/common';

const TONE_TO_CALLOUT: ReadonlyMap<NoticeTone, CalloutTone> = new Map([
  ['info', 'info'],
  ['success', 'success'],
  ['warning', 'warning'],
  ['error', 'danger'],
]);

/** Delay before a notice of this tone is auto-dismissed; a tone missing here is never auto-dismissed. */
const AUTO_DISMISS_MS: ReadonlyMap<NoticeTone, number> = new Map([
  ['success', 6000],
  ['info', 6000],
  ['warning', 12000],
]);

/** Keeps the toast stack from growing without bound; the oldest notices are dismissed first. */
const MAX_VISIBLE_NOTICES = 4;

function calloutTone(tone: NoticeTone): CalloutTone {
  return TONE_TO_CALLOUT.get(tone) ?? 'info';
}

/** Dismisses the oldest notices once the stack grows past the visible cap. */
function useOverflowDismissal(notices: readonly Notice[], dismissNotice: (id: string) => void): void {
  useEffect(() => {
    if (notices.length <= MAX_VISIBLE_NOTICES) {
      return;
    }
    const overflow = notices.slice(0, notices.length - MAX_VISIBLE_NOTICES);
    overflow.forEach((notice) => dismissNotice(notice.id));
  }, [notices, dismissNotice]);
}

/** Schedules (and cleans up) one auto-dismiss timer per notice, keyed by tone. */
function useAutoDismissTimers(notices: readonly Notice[], dismissNotice: (id: string) => void): void {
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const scheduled = timers.current;
    const activeIds = new Set(notices.map((notice) => notice.id));

    for (const [noticeId, timer] of scheduled) {
      if (!activeIds.has(noticeId)) {
        clearTimeout(timer);
        scheduled.delete(noticeId);
      }
    }

    notices.forEach((notice) => {
      if (scheduled.has(notice.id)) {
        return;
      }
      const delay = AUTO_DISMISS_MS.get(notice.tone);
      if (delay === undefined) {
        return;
      }
      const timer = setTimeout(() => {
        scheduled.delete(notice.id);
        dismissNotice(notice.id);
      }, delay);
      scheduled.set(notice.id, timer);
    });
  }, [notices, dismissNotice]);

  useEffect(
    () => () => {
      for (const timer of timers.current.values()) {
        clearTimeout(timer);
      }
      timers.current.clear();
    },
    [],
  );
}

export function NoticesContainer(): ReactElement {
  const { notices } = useAppState();
  const { dismissNotice } = useActions();

  useOverflowDismissal(notices, dismissNotice);
  useAutoDismissTimers(notices, dismissNotice);

  const items = notices.map((notice) => ({
    id: notice.id,
    tone: calloutTone(notice.tone),
    title: notice.title,
    message: notice.message,
  }));

  return <NoticeStack notices={items} onDismiss={dismissNotice} />;
}
