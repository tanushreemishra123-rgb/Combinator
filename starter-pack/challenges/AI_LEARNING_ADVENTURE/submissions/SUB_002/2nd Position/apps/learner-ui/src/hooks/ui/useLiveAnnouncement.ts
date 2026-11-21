import { useCallback, useSyncExternalStore } from 'react';

export type AnnouncementPoliteness = 'polite' | 'assertive';

export interface LiveAnnouncement {
  message: string;
  politeness: AnnouncementPoliteness;
  sequence: number;
}

export type AnnounceFn = (message: string, politeness?: AnnouncementPoliteness) => void;

export interface UseLiveAnnouncementResult {
  announcement?: LiveAnnouncement;
  announce: AnnounceFn;
}

const COALESCE_WINDOW_MS = 1500;

let currentAnnouncement: LiveAnnouncement | undefined;
let lastMessage = '';
let lastAnnouncedAt = 0;
let sequence = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): LiveAnnouncement | undefined {
  return currentAnnouncement;
}

export function announceLive(message: string, politeness: AnnouncementPoliteness = 'polite'): void {
  const trimmed = message.trim();
  if (trimmed.length === 0) return;
  const now = Date.now();
  if (trimmed === lastMessage && now - lastAnnouncedAt < COALESCE_WINDOW_MS) return;
  sequence += 1;
  currentAnnouncement = { message: trimmed, politeness, sequence };
  lastMessage = trimmed;
  lastAnnouncedAt = now;
  for (const listener of listeners) listener();
}

export function resetLiveAnnouncement(): void {
  currentAnnouncement = undefined;
  lastMessage = '';
  lastAnnouncedAt = 0;
  sequence = 0;
  for (const listener of listeners) listener();
}

export function useLiveAnnouncement(): UseLiveAnnouncementResult {
  const announcement = useSyncExternalStore(subscribe, getSnapshot);
  const announce = useCallback<AnnounceFn>((message, politeness = 'polite') => {
    announceLive(message, politeness);
  }, []);
  return { announcement, announce };
}
