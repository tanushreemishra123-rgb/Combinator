/** Shared "nothing to show" state for the PRD workspace's three tabs (never a blank panel). */
import type { ReactElement } from 'react';
import { EmptyState } from '../common';
import { FileTextIcon, HelpCircleIcon } from '../common/icons';

export interface PrdEmptyStateProps {
  /** The reason the PRD cannot be generated yet, from the state layer; null once the prerequisite is met. */
  prerequisite: string | null;
}

export function PrdEmptyState({ prerequisite }: PrdEmptyStateProps): ReactElement {
  if (prerequisite !== null) {
    return <EmptyState icon={<HelpCircleIcon />} title="Approve the scope first" message={prerequisite} />;
  }
  return (
    <EmptyState
      icon={<FileTextIcon />}
      title="Nothing generated yet"
      message="Use 'Generate the PRD' above to create the PRD and functional scope from the approved requirements."
    />
  );
}
