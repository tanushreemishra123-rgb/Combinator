/**
 * Public API of the export module (spec section 6, "Integrated Scoping Package"): `buildPackage`
 * assembles the format-neutral `PackageDocument`; `toMarkdown` / `toHtml` / `toDocx` /
 * `toWorkspaceJson` render it (or the raw session) to a downloadable file; `downloadFile` /
 * `fileNameFor` trigger the browser download; `generateExecutiveSummary` / `planExecutiveSummary`
 * produce the executive summary the mock AI provider also delegates to for the
 * 'summarize-package' task (see src/ai/providers/mockProvider.ts).
 */
export type { PackageBuildOptions, PackageDiagramId } from './packageBuilder';
export { buildPackage, buildPackageDiagrams } from './packageBuilder';
export { toMarkdown } from './markdown';
export { toHtml } from './html';
export { toDocx } from './docx';
export { toWorkspaceJson } from './workspaceJson';
export { downloadFile, fileNameFor } from './download';
export { generateExecutiveSummary, planExecutiveSummary, SUMMARY_TASK } from './summary';
