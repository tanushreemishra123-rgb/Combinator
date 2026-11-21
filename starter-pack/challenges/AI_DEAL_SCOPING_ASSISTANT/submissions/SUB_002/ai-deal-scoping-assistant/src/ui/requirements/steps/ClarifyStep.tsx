/** Step 3: "Clarify missing information" (spec Core User Journey step 5; "Missing information", "Assumptions", "Clarification questions"). */
import { useMemo } from 'react';
import type { ReactElement } from 'react';
import type { ScopeItem, ScopeItemKind, ScopingSession } from '../../../domain';
import { useActions } from '../../../state';
import { Card, EmptyState } from '../../common';
import { ClarifyItemCard } from '../clarify/ClarifyItemCard';

export interface ClarifyStepProps {
  session: ScopingSession;
}

interface ClarifyGroup {
  kind: ScopeItemKind;
  title: string;
  emptyMessage: string;
}

const CLARIFY_GROUPS: readonly ClarifyGroup[] = [
  { kind: 'gap', title: 'Missing information', emptyMessage: 'No gaps were identified in this analysis.' },
  { kind: 'assumption', title: 'Assumptions', emptyMessage: 'No assumptions were made in this analysis.' },
  { kind: 'question', title: 'Clarification questions', emptyMessage: 'No clarification questions were raised.' },
];

/** Unresolved-critical first, then unresolved, then resolved - so what needs attention surfaces first. */
function sortClarifyItems(items: readonly ScopeItem[]): ScopeItem[] {
  return [...items].sort((a, b) => {
    if (a.resolved !== b.resolved) {
      return a.resolved ? 1 : -1;
    }
    if (a.critical !== b.critical) {
      return a.critical ? -1 : 1;
    }
    return a.id.localeCompare(b.id, 'en', { numeric: true });
  });
}

export function ClarifyStep({ session }: ClarifyStepProps): ReactElement {
  const actions = useActions();
  const { scope } = session;

  const grouped = useMemo(() => {
    if (scope === null) {
      return null;
    }
    return CLARIFY_GROUPS.map((group) => ({
      ...group,
      items: sortClarifyItems(scope.items.filter((item) => item.kind === group.kind && item.review !== 'rejected')),
    }));
  }, [scope]);

  if (grouped === null) {
    return (
      <EmptyState
        title="Run the analysis first"
        message="Gaps, assumptions and clarification questions appear here once you run the AI-assisted requirement analysis."
      />
    );
  }

  return (
    <div className="stack stack-lg">
      {grouped.map((group) => (
        <Card key={group.kind} title={group.title}>
          {group.items.length === 0 ? (
            <EmptyState title="Nothing here" message={group.emptyMessage} />
          ) : (
            <div className="stack stack-md">
              {group.items.map((item) => (
                <ClarifyItemCard
                  key={item.id}
                  item={item}
                  onResolve={(id, resolution) => void actions.resolveScopeItem(id, resolution)}
                  onReopen={(id) => void actions.reopenScopeItem(id)}
                />
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
