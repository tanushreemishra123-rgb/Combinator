/** Export controls for the integrated package (spec 6: "exportable in at least one readable format"). */
import type { ReactElement } from 'react';
import type { ExportFormat } from '../../../domain';
import { Button, Card } from '../../common';
import { DownloadIcon, FileTextIcon } from '../../common/icons';

export interface ExportControlsProps {
  pendingFormat: ExportFormat | null;
  /** Disables every export button, e.g. while another async use case is already running. */
  disabled?: boolean;
  onExport: (format: ExportFormat) => void;
}

interface FormatOption {
  format: ExportFormat;
  /** Full description shown next to the button. */
  label: string;
  /** Short form for the button's own text, e.g. "Export Markdown". */
  buttonLabel: string;
  hint: string;
}

const FORMAT_OPTIONS: readonly FormatOption[] = [
  { format: 'markdown', label: 'Markdown', buttonLabel: 'Markdown', hint: 'A .md file for review tools and version control.' },
  { format: 'html', label: 'HTML (print to PDF)', buttonLabel: 'HTML', hint: 'Open the downloaded file and print it to PDF from the browser.' },
  { format: 'docx', label: 'DOCX', buttonLabel: 'DOCX', hint: 'A Word document for redlining with stakeholders.' },
  { format: 'json', label: 'Workspace JSON', buttonLabel: 'Workspace JSON', hint: 'The full schema-validated workspace, for backup or hand-off.' },
];

function FormatButton({ option, busy, disabled, onExport }: { option: FormatOption; busy: boolean; disabled: boolean; onExport: (format: ExportFormat) => void }): ReactElement {
  return (
    <div className="export-control-row">
      <div className="export-control-text">
        <p className="export-control-label">{option.label}</p>
        <p className="text-subtle text-sm">{option.hint}</p>
      </div>
      <Button variant="secondary" icon={<DownloadIcon />} busy={busy} disabled={disabled} onClick={() => onExport(option.format)}>
        Export {option.buttonLabel}
      </Button>
    </div>
  );
}

export function ExportControls({ pendingFormat, disabled = false, onExport }: ExportControlsProps): ReactElement {
  const anyPending = pendingFormat !== null;
  return (
    <Card title="Export controls" subtitle="Every export is stamped with the current export status and the mandatory disclaimer.">
      <div className="stack stack-sm export-controls-list">
        {FORMAT_OPTIONS.map((option) => (
          <FormatButton
            key={option.format}
            option={option}
            busy={pendingFormat === option.format}
            disabled={disabled || (anyPending && pendingFormat !== option.format)}
            onExport={onExport}
          />
        ))}
      </div>
      <p className="text-subtle text-xs export-controls-note">
        <FileTextIcon size={12} /> Downloads start immediately in your browser's default download location.
      </p>
    </Card>
  );
}
