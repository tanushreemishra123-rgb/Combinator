/**
 * One change's impact report (spec 6's example layout: "Change:", "Affected Areas:", "Unaffected
 * Areas:"), plus the plain-language explanation, tagged with the path that produced it (forum
 * ruling: mock AI mode's deterministic explanation must stay clearly labelled 'Mock AI mode').
 */
import type { ReactElement } from 'react';
import { describeAiMode } from '../../../ai';
import type { AiSettings } from '../../../ai';
import type { ImpactEntry, ImpactReport, UnaffectedEntry } from '../../../domain';
import { RULE_BASED_EXPLANATION_NOTE, sectionLabel } from '../../../impact';
import { AiGeneratedTag, Badge, Card, RefChips } from '../../common';

export interface ImpactReportCardProps {
  report: ImpactReport;
  aiSettings: AiSettings;
  onSelectRef: (id: string) => void;
}

function AffectedRow({ entry, onSelectRef }: { entry: ImpactEntry; onSelectRef: (id: string) => void }): ReactElement {
  return (
    <li className="impact-entry">
      <div className="cluster">
        <Badge tone="neutral">{sectionLabel(entry.section)}</Badge>
        <Badge tone={entry.action === 'regenerate' ? 'violet' : 'teal'}>{entry.action === 'regenerate' ? 'Regenerate' : 'Recalculate'}</Badge>
        <strong>{entry.area}</strong>
      </div>
      <RefChips refs={entry.elementIds} onSelect={onSelectRef} emptyLabel="Whole section" />
      <p className="text-sm text-muted">{entry.reason}</p>
    </li>
  );
}

function UnaffectedRow({ entry }: { entry: UnaffectedEntry }): ReactElement {
  return (
    <li className="impact-entry">
      <div className="cluster">
        <Badge tone="neutral">{sectionLabel(entry.section)}</Badge>
        <strong>{entry.area}</strong>
      </div>
      <p className="text-sm text-muted">{entry.reason}</p>
    </li>
  );
}

export function ImpactReportCard({ report, aiSettings, onSelectRef }: ImpactReportCardProps): ReactElement {
  const isFallback = report.explanation.includes(RULE_BASED_EXPLANATION_NOTE);
  return (
    <Card title={report.change.label} subtitle={`From "${report.change.from}" to "${report.change.to}"`}>
      <div className="stack stack-md">
        <section>
          <h4 className="impact-section-heading">Affected areas</h4>
          {report.affected.length === 0 ? (
            <p className="text-muted text-sm">No generated deliverable depends on this change - nothing needs to be regenerated or recalculated.</p>
          ) : (
            <ul className="stack stack-sm">
              {report.affected.map((entry, index) => (
                <AffectedRow key={`${entry.section}-${entry.area}-${index}`} entry={entry} onSelectRef={onSelectRef} />
              ))}
            </ul>
          )}
        </section>
        <section>
          <h4 className="impact-section-heading">Unaffected areas</h4>
          {report.unaffected.length === 0 ? (
            <p className="text-muted text-sm">No areas were confirmed unaffected for this change.</p>
          ) : (
            <ul className="stack stack-sm">
              {report.unaffected.map((entry, index) => (
                <UnaffectedRow key={`${entry.section}-${entry.area}-${index}`} entry={entry} />
              ))}
            </ul>
          )}
        </section>
        <section className="stack stack-xs">
          {isFallback ? <Badge tone="warning">Rule-based explanation (AI unavailable)</Badge> : <AiGeneratedTag label={`AI-generated explanation - ${describeAiMode(aiSettings)}`} />}
          <p className="impact-explanation text-sm">{report.explanation}</p>
        </section>
      </div>
    </Card>
  );
}
