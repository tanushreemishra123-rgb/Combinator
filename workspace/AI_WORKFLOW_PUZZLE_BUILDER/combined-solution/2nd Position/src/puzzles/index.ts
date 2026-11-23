import type { Puzzle, PuzzleKit } from './types';
import { makeKit } from './types';
import { meetingSummarizer } from './meeting-summarizer';
import { knowledgeAssistant } from './knowledge-assistant';
import { ticketRouter } from './ticket-router';
import { researchTimeout } from './research-timeout';
import { approvalGate } from './approval-gate';
import { dataExtractor } from './data-extractor';
import { fallbackDrill } from './fallback-drill';
import { resumeMission } from './resume-mission';

export const PUZZLES: Puzzle[] = [
  meetingSummarizer,
  knowledgeAssistant,
  ticketRouter,
  researchTimeout,
  approvalGate,
  dataExtractor,
  fallbackDrill,
  resumeMission,
].sort((a, b) => a.order - b.order);

const kits = new Map<string, PuzzleKit>();

export function getPuzzle(id: string): Puzzle {
  const puzzle = PUZZLES.find((p) => p.id === id);
  if (!puzzle) throw new Error(`Unknown puzzle "${id}"`);
  return puzzle;
}

export function getKit(id: string): PuzzleKit {
  let kit = kits.get(id);
  if (!kit) {
    kit = makeKit(getPuzzle(id));
    kits.set(id, kit);
  }
  return kit;
}
