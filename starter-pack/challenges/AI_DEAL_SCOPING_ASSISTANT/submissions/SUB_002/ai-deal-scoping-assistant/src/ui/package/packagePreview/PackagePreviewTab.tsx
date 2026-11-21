/**
 * "Package preview and export" tab (spec 6, "Integrated Scoping Package"; Recommended Application
 * Sections 6: "Integrated package preview", "Export controls"). Ties together the executive
 * summary, the export-readiness banner, the section outline plus preview built from
 * `buildPackageForSession`/`buildPackageDiagrams`, and the format export controls. The mandatory
 * disclaimer is always visible here, independent of every other state.
 */
import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { EXPORT_DISCLAIMER } from '../../../domain';
import type { ExportFormat, ScopingSession } from '../../../domain';
import { buildPackageDiagrams } from '../../../export';
import { buildPackageForSession, selectHasOutputs, useActions, useAppState, useBusy } from '../../../state';
import { Callout, Card } from '../../common';
import { ExecutiveSummaryCard } from './ExecutiveSummaryCard';
import { ExportControls } from './ExportControls';
import { ExportStatusBanner } from './ExportStatusBanner';
import { PackageDocumentPreview } from './PackageDocumentPreview';
import { PackageSectionOutline } from './PackageSectionOutline';
import { isQualityReportOutdated } from '../qualityOutdated';

export interface PackagePreviewTabProps {
  session: ScopingSession;
  onOpenQualityTab: () => void;
}

function scrollToSection(sectionId: string): void {
  document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function NoDeliverablesNotice(): ReactElement {
  return (
    <Callout tone="info" title="No deliverables generated yet">
      This preview fills in as you generate each stage. It is always exportable, even early, so nothing is ever
      blank while you work through the workspaces.
    </Callout>
  );
}

export function PackagePreviewTab({ session, onOpenQualityTab }: PackagePreviewTabProps): ReactElement {
  const actions = useActions();
  const { aiSettings } = useAppState();
  const globalBusy = useBusy() !== null;
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);

  const packageDocument = useMemo(() => buildPackageForSession(session, aiSettings, new Date().toISOString()), [session, aiSettings]);
  const diagrams = useMemo(() => buildPackageDiagrams(session), [session]);
  const hasOutputs = useMemo(() => selectHasOutputs(session), [session]);
  const outdated = useMemo(() => isQualityReportOutdated(session), [session]);

  async function handleExport(format: ExportFormat): Promise<void> {
    setExportingFormat(format);
    try {
      await actions.exportPackage(format);
    } finally {
      setExportingFormat(null);
    }
  }

  return (
    <div className="stack stack-lg package-preview-tab">
      <Callout tone="warning" title="Mandatory disclaimer">
        {EXPORT_DISCLAIMER}
      </Callout>

      {hasOutputs ? null : <NoDeliverablesNotice />}

      <ExecutiveSummaryCard session={session} aiSettings={aiSettings} disabled={globalBusy || exportingFormat !== null} />

      <ExportStatusBanner quality={session.quality} outdated={outdated} onOpenQualityTab={onOpenQualityTab} />

      <Card title="Integrated package preview" subtitle="The exact content every export format renders, kept in one place so it never drifts.">
        <div className="package-preview-layout">
          <PackageSectionOutline sections={packageDocument.sections} onSelect={scrollToSection} />
          <div className="package-preview-scroll">
            <PackageDocumentPreview document={packageDocument} diagrams={diagrams} />
          </div>
        </div>
      </Card>

      <ExportControls pendingFormat={exportingFormat} disabled={globalBusy} onExport={(format) => void handleExport(format)} />
    </div>
  );
}
