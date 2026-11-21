/**
 * Document ingestion for ideation mode (challenge §Ideation Mode / Document
 * ingestion). Supports DOCX, PDF and PPTX. Extracts text with preserved
 * locations (page / slide / section), speaker notes for PPTX, and flags
 * unreliable extraction. Never invents missing content: if a format cannot be
 * parsed, the block is marked not_verifiable.
 *
 * Pure-JS parsers only (pdfjs-dist, mammoth, adm-zip + fast-xml-parser) so the
 * tool runs in a minimal container with no native build step.
 */
import AdmZip from "adm-zip";
import mammoth from "mammoth";
import { XMLParser } from "fast-xml-parser";
import { basename, extname } from "node:path";
import { readFileSync } from "node:fs";

export interface ContentBlock {
  /** page / slide / section locator, e.g. "p.3", "slide 2", "notes 2". */
  locator: string;
  kind: "paragraph" | "heading" | "table" | "slide" | "speaker_note" | "caption" | "unknown";
  text: string;
  reliable: boolean;
}

export interface ExtractedDocument {
  file: string; // absolute
  fileName: string;
  format: "docx" | "pdf" | "pptx" | "unknown";
  blocks: ContentBlock[];
  reliable: boolean;
  note?: string;
}

function clean(s: string): string {
  return s.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ── DOCX ───────────────────────────────────────────────────────────────────
async function extractDocx(file: string): Promise<ExtractedDocument> {
  const buffer = readFileSync(file);
  const blocks: ContentBlock[] = [];
  try {
    const html = await mammoth.convertToHtml({ buffer });
    // Split the HTML into block elements, keeping headings/tables distinct.
    const re = /<(h[1-6]|p|table)[^>]*>([\s\S]*?)<\/\1>/gi;
    let m: RegExpExecArray | null;
    let idx = 0;
    while ((m = re.exec(html.value))) {
      const tag = m[1]!.toLowerCase();
      const inner = clean(m[2]!.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"));
      if (!inner) continue;
      idx++;
      blocks.push({
        locator: `section ${idx}`,
        kind: tag.startsWith("h") ? "heading" : tag === "table" ? "table" : "paragraph",
        text: inner,
        reliable: true,
      });
    }
    if (blocks.length === 0) {
      const raw = await mammoth.extractRawText({ buffer });
      for (const [i, para] of clean(raw.value).split(/\n{2,}/).entries()) {
        if (para.trim()) blocks.push({ locator: `section ${i + 1}`, kind: "paragraph", text: para.trim(), reliable: true });
      }
    }
    return { file, fileName: basename(file), format: "docx", blocks, reliable: blocks.length > 0 };
  } catch (e) {
    return {
      file,
      fileName: basename(file),
      format: "docx",
      blocks: [],
      reliable: false,
      note: `DOCX extraction failed: ${(e as Error).message}`,
    };
  }
}

// ── PDF ──────────────────────────────────────────────────────────────────────
async function extractPdf(file: string): Promise<ExtractedDocument> {
  const blocks: ContentBlock[] = [];
  try {
    // pdfjs-dist legacy build works headless in Node.
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const data = new Uint8Array(readFileSync(file));
    const doc = await pdfjs.getDocument({ data, isEvalSupported: false, useSystemFonts: true }).promise;
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const text = clean(
        content.items
          .map((it: any) => ("str" in it ? it.str : ""))
          .join(" ")
          .replace(/\s+/g, " "),
      );
      if (text) blocks.push({ locator: `p.${p}`, kind: "paragraph", text, reliable: text.length > 20 });
    }
    const reliable = blocks.some((b) => b.reliable);
    return {
      file,
      fileName: basename(file),
      format: "pdf",
      blocks,
      reliable,
      note: reliable ? undefined : "PDF yielded little extractable text (possibly scanned; OCR not available).",
    };
  } catch (e) {
    return {
      file,
      fileName: basename(file),
      format: "pdf",
      blocks: [],
      reliable: false,
      note: `PDF extraction failed: ${(e as Error).message}`,
    };
  }
}

// ── PPTX ───────────────────────────────────────────────────────────────────
function pptxTextRuns(node: unknown, out: string[]): void {
  if (node == null) return;
  if (Array.isArray(node)) {
    for (const n of node) pptxTextRuns(n, out);
    return;
  }
  if (typeof node === "object") {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k === "a:t") {
        if (typeof v === "string") out.push(v);
        else if (Array.isArray(v)) for (const t of v) if (typeof t === "string") out.push(t);
      } else pptxTextRuns(v, out);
    }
  }
}

function extractPptx(file: string): ExtractedDocument {
  const blocks: ContentBlock[] = [];
  try {
    const zip = new AdmZip(readFileSync(file));
    const parser = new XMLParser({ ignoreAttributes: true, preserveOrder: false });
    const entries = zip.getEntries();
    const slideEntries = entries
      .filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.entryName))
      .sort((a, b) => slideNum(a.entryName) - slideNum(b.entryName));
    const noteEntries = new Map(
      entries
        .filter((e) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(e.entryName))
        .map((e) => [slideNum(e.entryName), e]),
    );
    for (const e of slideEntries) {
      const n = slideNum(e.entryName);
      const xml = parser.parse(zip.readAsText(e));
      const runs: string[] = [];
      pptxTextRuns(xml, runs);
      const text = clean(runs.join(" ").replace(/\s+/g, " "));
      if (text) blocks.push({ locator: `slide ${n}`, kind: "slide", text, reliable: true });
      const note = noteEntries.get(n);
      if (note) {
        const nruns: string[] = [];
        pptxTextRuns(parser.parse(zip.readAsText(note)), nruns);
        const ntext = clean(nruns.join(" ").replace(/\s+/g, " "));
        if (ntext) blocks.push({ locator: `notes ${n}`, kind: "speaker_note", text: ntext, reliable: true });
      }
    }
    return { file, fileName: basename(file), format: "pptx", blocks, reliable: blocks.length > 0 };
  } catch (e) {
    return {
      file,
      fileName: basename(file),
      format: "pptx",
      blocks: [],
      reliable: false,
      note: `PPTX extraction failed: ${(e as Error).message}`,
    };
  }
}

function slideNum(name: string): number {
  const m = name.match(/(\d+)\.xml$/);
  return m ? Number(m[1]) : 0;
}

export async function extractDocument(file: string): Promise<ExtractedDocument> {
  const ext = extname(file).toLowerCase();
  if (ext === ".docx") return extractDocx(file);
  if (ext === ".pdf") return extractPdf(file);
  if (ext === ".pptx") return extractPptx(file);
  return {
    file,
    fileName: basename(file),
    format: "unknown",
    blocks: [],
    reliable: false,
    note: `Unsupported format ${ext}; marked not_verifiable.`,
  };
}
