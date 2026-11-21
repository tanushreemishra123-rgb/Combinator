/**
 * Tiny drag-and-drop bridge. HTML5 DnD hides payload data during dragover,
 * so the current drag is mirrored in module state for live target styling.
 * Every drag action also has a click-based equivalent in the UI.
 */

export type DragPayload =
  | { type: 'palette'; entryId: string }
  | { type: 'upgrade'; entryId: string }
  | { type: 'move'; stepId: string };

const MIME = 'application/x-workflow-puzzle';

let current: DragPayload | null = null;

export function beginDrag(e: React.DragEvent, payload: DragPayload) {
  current = payload;
  e.dataTransfer.setData(MIME, JSON.stringify(payload));
  e.dataTransfer.effectAllowed = 'move';
}

export function endDrag() {
  current = null;
}

export function draggedPayload(): DragPayload | null {
  return current;
}

export function readDrop(e: React.DragEvent): DragPayload | null {
  const raw = e.dataTransfer.getData(MIME);
  if (!raw) return current;
  try {
    return JSON.parse(raw) as DragPayload;
  } catch {
    return current;
  }
}
