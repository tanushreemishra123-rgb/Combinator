/**
 * Format-neutral model of the integrated scoping package. The preview UI and every exporter
 * (Markdown, HTML/print-to-PDF, DOCX) render this one structure, so all formats stay consistent.
 */

export const EXPORT_DISCLAIMER =
  'This document is an AI-assisted internal planning output based on customer requirements and stated assumptions. It requires review and validation by qualified sales, architecture, delivery, security, and commercial stakeholders. It is not a final quote, contractual commitment, or delivery guarantee.';

export type DocBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; level: 3 | 4; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'table'; columns: string[]; rows: string[][] }
  | { type: 'callout'; tone: 'info' | 'warning' | 'danger' | 'success'; title: string; text: string }
  | { type: 'keyValues'; pairs: { key: string; value: string }[] }
  | { type: 'diagram'; title: string; mermaid: string; diagramId: 'architecture' | 'data-flow' };

export const PACKAGE_SECTION_IDS = [
  'executive-summary',
  'customer-objectives',
  'requirement-summary',
  'prd',
  'functional-scope',
  'solution-architecture',
  'architecture-diagram',
  'data-strategy',
  'integration-architecture',
  'ai-solution-approach',
  'recommended-technologies',
  'delivery-phases',
  'effort-timeline',
  'rom-commercials',
  'assumptions',
  'risks',
  'dependencies',
  'open-questions',
  'requirement-coverage',
  'traceability',
  'quality-review',
  'change-log',
] as const;
export type PackageSectionId = (typeof PACKAGE_SECTION_IDS)[number];

export interface PackageSection {
  id: PackageSectionId;
  title: string;
  blocks: DocBlock[];
}

export interface PackageDocument {
  title: string;
  subtitle: string;
  generatedAt: string;
  aiModeLabel: string;
  exportStatus: string;
  disclaimer: string;
  sections: PackageSection[];
}

export type ExportFormat = 'markdown' | 'html' | 'docx' | 'json';
