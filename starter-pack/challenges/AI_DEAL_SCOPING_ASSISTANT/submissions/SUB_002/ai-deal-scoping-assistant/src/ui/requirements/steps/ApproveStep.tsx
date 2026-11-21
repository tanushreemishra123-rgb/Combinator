/** Step 4: "Approve the requirements" - the gate for every downstream deliverable (spec Core User Journey step 6). */
import type { ReactElement } from 'react';
import type { ScopingSession } from '../../../domain';
import { isScopeApproved } from '../../../scope';
import { selectHasOutputs, useActions, useBusy } from '../../../state';
import { Badge, Button, Callout, Card, EmptyState, MetricGrid, MetricTile } from '../../common';
import { formatDateTime } from '../../common/format';
import { useWorkspaceNavigation } from '../../navigation';

export interface ApproveStepProps {
  session: ScopingSession;
}

function ApprovalStatus({ session }: { session: ScopingSession }): ReactElement {
  const { scope } = session;
  if (scope === null || scope.approvedAt === null) {
    return <Badge tone="neutral">Not yet approved</Badge>;
  }
  if (isScopeApproved(scope)) {
    return <Badge tone="success">Approved on {formatDateTime(scope.approvedAt)} (version {scope.approvedVersion})</Badge>;
  }
  return (
    <Callout tone="warning" title="Needs re-approval">
      Approved on {formatDateTime(scope.approvedAt)} at version {scope.approvedVersion}, but the scope has since changed to version {scope.version}.
      Approve it again so downstream generation uses the latest content.
    </Callout>
  );
}

export function ApproveStep({ session }: ApproveStepProps): ReactElement {
  const actions = useActions();
  const busy = useBusy();
  const { scope } = session;

  if (scope === null) {
    return <EmptyState title="Run the analysis first" message="There is no scope model to approve yet - run the AI-assisted requirement analysis in 'Understand the customer need'." />;
  }

  const pendingCount = scope.items.filter((item) => item.review === 'pending').length;
  const hasOutputs = selectHasOutputs(session);
  const isBusy = busy !== null;

  return (
    <div className="stack stack-lg">
      <Card title="Approval status">
        <div className="stack stack-md">
          <ApprovalStatus session={session} />
          <MetricGrid>
            <MetricTile label="Pending review" value={pendingCount} tone={pendingCount > 0 ? 'warning' : 'success'} />
            <MetricTile label="Total items" value={scope.items.length} />
            <MetricTile label="Current version" value={scope.version} />
          </MetricGrid>
          <div className="cluster">
            <Button variant="secondary" disabled={pendingCount === 0 || isBusy} onClick={() => void actions.approveAllPending()}>
              Approve all pending
            </Button>
            <Button variant="primary" disabled={pendingCount > 0 || isBusy} title={pendingCount > 0 ? 'Approve or reject every pending item first.' : undefined} onClick={() => actions.approveScope()}>
              Approve the scope model
            </Button>
          </div>
          {pendingCount > 0 ? <p className="text-subtle text-sm">{pendingCount} item(s) still need to be approved or rejected before the scope model can be approved.</p> : null}
        </div>
      </Card>
      <Callout tone="info" title="Why approval matters">
        Generating the PRD, architecture, data and integration strategy, AI approach and estimate all require an approved scope
        model, so nothing unreviewed flows into a downstream deliverable.
      </Callout>
      {hasOutputs ? <OutputsExistNotice /> : null}
    </div>
  );
}

function OutputsExistNotice(): ReactElement {
  const { navigate } = useWorkspaceNavigation();
  return (
    <Callout tone="warning" title="Downstream deliverables already exist">
      <p>
        Editing an approved requirement, assumption or configuration now goes through the change-impact flow automatically:
        the affected outputs are marked stale instead of silently changing.
      </p>
      <Button variant="ghost" size="sm" onClick={() => navigate('package', 'change-impact')}>
        Review the Change Impact tab of the Final Scoping Package
      </Button>
    </Callout>
  );
}
