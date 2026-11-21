/**
 * Normalised representation of the customer's requirements text.
 * Every extracted scope item points back into this structure (section + line range + quote),
 * which is what makes requirement-level source traceability verifiable.
 */
import { z } from 'zod';

export type SourceFormat = 'text' | 'markdown' | 'docx' | 'pdf';

export interface SourceLine {
  /** 1-based line number inside the normalised text. */
  number: number;
  text: string;
  sectionId: string;
}

export interface SourceSection {
  id: string;
  title: string;
  level: number;
  lineStart: number;
  lineEnd: number;
}

export interface UploadedDocumentInfo {
  name: string;
  format: SourceFormat;
  characters: number;
  addedAt: string;
}

export interface NormalizedDocument {
  text: string;
  lines: SourceLine[];
  sections: SourceSection[];
  wordCount: number;
}

/** Pointer from a scope item to the originating customer text. */
export const SourceRefSchema = z.object({
  sectionId: z.string().default(''),
  sectionTitle: z.string().default(''),
  lineStart: z.number().int().nonnegative().default(0),
  lineEnd: z.number().int().nonnegative().default(0),
  /** Verbatim customer wording the item is based on. */
  quote: z.string().default(''),
  /** Set by the grounding validator: true only when the quote was located in the source text. */
  verified: z.boolean().default(false),
});
export type SourceRef = z.infer<typeof SourceRefSchema>;
