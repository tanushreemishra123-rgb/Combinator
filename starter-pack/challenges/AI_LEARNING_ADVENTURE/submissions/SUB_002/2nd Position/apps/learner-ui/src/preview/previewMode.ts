import type {
  CatalogDto,
  IsoDateTime,
  MissionDetail,
  PreviewPayloadDto,
  ProgressSnapshotDto,
} from '@ai-learning-adventure/types';

let previewToken: string | undefined;
let payload: PreviewPayloadDto | undefined;
let snapshot: ProgressSnapshotDto | undefined;

export function readPreviewTokenFromLocation(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const token = new URLSearchParams(window.location.search).get('preview');
  return token === null || token.trim().length === 0 ? undefined : token;
}

export function initPreviewMode(token: string): void {
  previewToken = token;
}

export function isPreviewMode(): boolean {
  return previewToken !== undefined;
}

export function getPreviewToken(): string | undefined {
  return previewToken;
}

export function setPreviewPayload(data: PreviewPayloadDto, learnerId: string): void {
  payload = data;
  snapshot = {
    learnerId,
    schemaVersion: 1,
    revision: new Date().toISOString() as IsoDateTime,
    missions: {},
    attempts: [],
    flashcardRatings: {},
    earnedAwards: [],
  };
}

export function getPreviewCatalog(): CatalogDto | undefined {
  return payload?.catalog;
}

export function getPreviewMission(): MissionDetail | undefined {
  return payload?.mission;
}

export function getPreviewSnapshot(): ProgressSnapshotDto | undefined {
  return snapshot;
}

export function setPreviewSnapshot(next: ProgressSnapshotDto): void {
  snapshot = next;
}

export function resetPreviewMode(): void {
  previewToken = undefined;
  payload = undefined;
  snapshot = undefined;
}
