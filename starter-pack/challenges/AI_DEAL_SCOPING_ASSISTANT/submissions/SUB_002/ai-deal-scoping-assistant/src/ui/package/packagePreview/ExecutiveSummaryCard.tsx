/** Executive summary block with its own refresh action (spec 6: "Executive summary"). */
import { useState } from 'react';
import type { ReactElement } from 'react';
import { describeAiMode } from '../../../ai';
import type { AiSettings } from '../../../ai';
import type { ScopingSession } from '../../../domain';
import { useActions } from '../../../state';
import { AiGeneratedTag, Button, Card, EmptyState } from '../../common';

export interface ExecutiveSummaryCardProps {
  session: ScopingSession;
  aiSettings: AiSettings;
  /** Disables the refresh action while another async use case (export, regeneration, ...) is running. */
  disabled?: boolean;
}

export function ExecutiveSummaryCard({ session, aiSettings, disabled = false }: ExecutiveSummaryCardProps): ReactElement {
  const actions = useActions();
  const [pending, setPending] = useState(false);

  async function handleRefresh(): Promise<void> {
    setPending(true);
    try {
      await actions.refreshExecutiveSummary();
    } finally {
      setPending(false);
    }
  }

  const summary = session.executiveSummary.trim();

  return (
    <Card
      title="Executive summary"
      actions={
        <Button size="sm" variant="secondary" busy={pending} disabled={disabled} onClick={() => void handleRefresh()}>
          Refresh executive summary
        </Button>
      }
    >
      {summary === '' ? (
        <EmptyState title="No executive summary yet" message="Refresh to generate a summary grounded in the reviewed scope and current configuration." />
      ) : (
        <div className="stack stack-sm">
          <AiGeneratedTag label={`AI-generated summary - ${describeAiMode(aiSettings)}`} />
          {summary.split('\n\n').map((paragraph, index) => (
            <p key={index} className="text-sm">
              {paragraph}
            </p>
          ))}
        </div>
      )}
    </Card>
  );
}
