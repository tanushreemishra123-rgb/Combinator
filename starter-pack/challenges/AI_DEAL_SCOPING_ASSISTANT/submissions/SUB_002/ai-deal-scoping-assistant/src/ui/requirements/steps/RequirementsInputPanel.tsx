/**
 * Requirements input: paste plain text / Markdown / RFP / discovery notes, upload a document,
 * inline validation issues, and the primary "Run AI-assisted requirement analysis" action (spec
 * "Functional Requirements 1").
 */
import type { ReactElement } from 'react';
import type { UploadedDocumentInfo, ValidationIssue } from '../../../domain';
import { Badge, Button, Callout, Card, Field, TextArea } from '../../common';
import { SparklesIcon } from '../../common/icons';
import type { AnalysisPathDescription } from '../analysisPath';
import { FileUploadZone } from './FileUploadZone';

export interface RequirementsInputPanelProps {
  rawText: string;
  onChangeText: (text: string) => void;
  issues: readonly ValidationIssue[];
  documents: readonly UploadedDocumentInfo[];
  uploading: boolean;
  onFiles: (files: File[]) => void;
  analysisPath: AnalysisPathDescription;
  isAnalyzing: boolean;
  onRunAnalysis: () => void;
}

function issueTone(issues: readonly ValidationIssue[]): 'danger' | 'warning' {
  return issues.some((issue) => issue.severity === 'error') ? 'danger' : 'warning';
}

export function RequirementsInputPanel({
  rawText,
  onChangeText,
  issues,
  documents,
  uploading,
  onFiles,
  analysisPath,
  isAnalyzing,
  onRunAnalysis,
}: RequirementsInputPanelProps): ReactElement {
  const blockingIssue = issues.find((issue) => issue.severity === 'error');
  const disabledReason = blockingIssue?.message ?? (isAnalyzing ? 'Analysis is already running.' : null);

  return (
    <Card title="Customer requirements" subtitle="Paste text, Markdown, RFP content or discovery notes, or upload a document.">
      <div className="stack stack-md">
        <Field label="Requirements text" hint="Business requirements, technical requirements and existing-system information are all welcome here.">
          {(props) => <TextArea {...props} rows={12} value={rawText} onChange={onChangeText} placeholder="Paste the customer's requirements, RFP content or discovery-call notes here..." />}
        </Field>
        <FileUploadZone documents={documents} uploading={uploading} onFiles={onFiles} />
        {issues.length > 0 ? (
          <Callout tone={issueTone(issues)} title="Before you can run the analysis">
            <ul className="stack stack-xs">
              {issues.map((issue) => (
                <li key={issue.code}>{issue.message}</li>
              ))}
            </ul>
          </Callout>
        ) : null}
        <div className="requirements-analysis-action">
          <div className="stack stack-xs">
            <span className="cluster">
              <Badge tone="violet" icon={<SparklesIcon size={12} />}>
                {analysisPath.modeLabel}
              </Badge>
            </span>
            <p className="text-muted text-sm">{analysisPath.detail}</p>
          </div>
          <Button
            variant="primary"
            busy={isAnalyzing}
            disabled={disabledReason !== null}
            title={disabledReason ?? undefined}
            onClick={onRunAnalysis}
          >
            Run AI-assisted requirement analysis
          </Button>
        </div>
        {disabledReason && !isAnalyzing ? <p className="text-subtle text-sm">{disabledReason}</p> : null}
      </div>
    </Card>
  );
}
