/**
 * Export status banner (spec 6: "Blocked" / "Review Required" must "explain what to fix" but still
 * allow a draft export). Reads the last quality-gate report; when none has run yet, explains that
 * exporting now runs the gate automatically and stamps whatever status it finds.
 */
import type { ReactElement } from 'react';
import type { QualityReport } from '../../../domain';
import { Button, Callout, formatDateTime } from '../../common';

export interface ExportStatusBannerProps {
  quality: QualityReport | null;
  outdated: boolean;
  onOpenQualityTab: () => void;
}

function failingCheckCount(quality: QualityReport): number {
  return quality.checks.filter((check) => check.status !== 'pass').length;
}

function OutdatedNote({ onOpenQualityTab }: { onOpenQualityTab: () => void }): ReactElement {
  return (
    <p className="export-status-outdated text-sm">
      The reviewed scope or a generated section has changed since this report ran.{' '}
      <Button variant="ghost" size="sm" onClick={onOpenQualityTab}>
        Re-run the quality gate
      </Button>
    </p>
  );
}

function NotRunBanner({ onOpenQualityTab }: { onOpenQualityTab: () => void }): ReactElement {
  return (
    <Callout tone="info" title="The pre-export quality check has not run yet">
      Exporting now will run it automatically and stamp the result in the document. For a full look at what needs
      attention first, open the Quality Gate tab.
      <div className="export-status-action">
        <Button variant="secondary" size="sm" onClick={onOpenQualityTab}>
          Open Quality Gate
        </Button>
      </div>
    </Callout>
  );
}

function ReadyBanner({ quality, outdated, onOpenQualityTab }: { quality: QualityReport; outdated: boolean; onOpenQualityTab: () => void }): ReactElement {
  return (
    <Callout tone="success" title="Ready to export">
      The pre-export quality check (run {formatDateTime(quality.ranAt)}) found nothing blocking export.
      {outdated ? <OutdatedNote onOpenQualityTab={onOpenQualityTab} /> : null}
    </Callout>
  );
}

function ReviewRequiredBanner({ quality, outdated, onOpenQualityTab }: { quality: QualityReport; outdated: boolean; onOpenQualityTab: () => void }): ReactElement {
  return (
    <Callout tone="warning" title={`Review required - ${failingCheckCount(quality)} check(s) need attention`}>
      You can still export a draft; the export status is stamped in the document so reviewers know it needs a look.
      <div className="export-status-action">
        <Button variant="secondary" size="sm" onClick={onOpenQualityTab}>
          Review the findings
        </Button>
      </div>
      {outdated ? <OutdatedNote onOpenQualityTab={onOpenQualityTab} /> : null}
    </Callout>
  );
}

function BlockedBanner({ quality, outdated, onOpenQualityTab }: { quality: QualityReport; outdated: boolean; onOpenQualityTab: () => void }): ReactElement {
  return (
    <Callout tone="danger" title={`Blocked - ${failingCheckCount(quality)} check(s) failed`}>
      Fix the failing checks before sharing this package. You can still export it now as a clearly-stamped draft.
      <div className="export-status-action">
        <Button variant="secondary" size="sm" onClick={onOpenQualityTab}>
          Fix the failing checks
        </Button>
      </div>
      {outdated ? <OutdatedNote onOpenQualityTab={onOpenQualityTab} /> : null}
    </Callout>
  );
}

export function ExportStatusBanner({ quality, outdated, onOpenQualityTab }: ExportStatusBannerProps): ReactElement {
  if (quality === null) {
    return <NotRunBanner onOpenQualityTab={onOpenQualityTab} />;
  }
  if (quality.summary.exportStatus === 'Ready') {
    return <ReadyBanner quality={quality} outdated={outdated} onOpenQualityTab={onOpenQualityTab} />;
  }
  if (quality.summary.exportStatus === 'Review Required') {
    return <ReviewRequiredBanner quality={quality} outdated={outdated} onOpenQualityTab={onOpenQualityTab} />;
  }
  return <BlockedBanner quality={quality} outdated={outdated} onOpenQualityTab={onOpenQualityTab} />;
}
