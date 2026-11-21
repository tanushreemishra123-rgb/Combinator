/** Shared notice constructor for use cases (see `../types.ts` for the `Notice` shape). */
import { newUid } from '../../domain';
import type { Notice, NoticeTone, UseCaseDeps } from '../types';

export function makeNotice(tone: NoticeTone, title: string, message: string): Notice {
  return { id: newUid(), tone, title, message };
}

export function dismissNotice(deps: UseCaseDeps, noticeId: string): void {
  deps.dispatch({ type: 'DISMISS_NOTICE', noticeId });
}

export function clearNotices(deps: UseCaseDeps): void {
  deps.dispatch({ type: 'CLEAR_NOTICES' });
}
