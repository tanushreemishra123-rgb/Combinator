/**
 * Root of the Final Scoping Package workspace (spec "Recommended Application Sections 6"). Takes no
 * props: reads the active session through the state hooks and is the single place that decides
 * which of the four tabs is showing. Honours the cross-workspace navigation focus id so an id chip
 * anywhere in the app can deep-link straight into "change-impact" | "coverage" | "quality" |
 * "package".
 */
import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { useActiveSession } from '../../state';
import { EmptyState, SectionHeader, Tabs } from '../common';
import type { TabItem } from '../common';
import { FileTextIcon } from '../common/icons';
import { useWorkspaceNavigation } from '../navigation';
import { ChangeImpactPanel } from './changeImpact/ChangeImpactPanel';
import { CoverageTab } from './coverage/CoverageTab';
import { PackagePreviewTab } from './packagePreview/PackagePreviewTab';
import { QualityTab } from './quality/QualityTab';
import './package.css';

const TAB_ITEMS: TabItem[] = [
  { id: 'change-impact', label: 'Change Impact' },
  { id: 'coverage', label: 'Requirement Coverage' },
  { id: 'quality', label: 'Quality Gate' },
  { id: 'package', label: 'Package Preview and Export' },
];

type PackageTabId = (typeof TAB_ITEMS)[number]['id'];

function isPackageTabId(value: string): value is PackageTabId {
  return TAB_ITEMS.some((item) => item.id === value);
}

function NoActiveSession(): ReactElement {
  return (
    <div className="stack stack-lg">
      <SectionHeader eyebrow="Final Scoping Package" title="No active session" as="h1" />
      <EmptyState
        icon={<FileTextIcon />}
        title="No active session"
        message="Create or open a scoping session to review its change impact, coverage, quality gate and final package."
      />
    </div>
  );
}

export function PackageWorkspace(): ReactElement {
  const session = useActiveSession();
  const navigation = useWorkspaceNavigation();
  const [activeTab, setActiveTab] = useState<PackageTabId>('change-impact');
  const [lastFocusId, setLastFocusId] = useState<string | null>(null);

  // Opens the tab named by a cross-workspace focus request (e.g. an id chip's "quality" deep link),
  // computed during render (React's documented "adjust state on prop change" pattern) rather than in
  // an effect - it only reacts to a genuinely new focusId, not every re-render.
  if (navigation.focusId !== lastFocusId) {
    setLastFocusId(navigation.focusId);
    if (navigation.activeWorkspace === 'package' && navigation.focusId !== null && isPackageTabId(navigation.focusId)) {
      setActiveTab(navigation.focusId);
    }
  }

  // Clearing the shared focus id is a side effect on an external system (the navigation context),
  // so it belongs in an effect - it fires once per genuinely new, already-applied focus request.
  useEffect(() => {
    if (lastFocusId !== null) {
      navigation.clearFocus();
    }
  }, [lastFocusId, navigation]);

  if (session === null) {
    return <NoActiveSession />;
  }

  return (
    <div className="package-workspace stack stack-lg">
      <SectionHeader eyebrow="Final Scoping Package" title="Change impact, coverage, quality and export" description={session.name} as="h1" />
      <Tabs
        items={TAB_ITEMS}
        activeId={activeTab}
        onChange={(id) => {
          if (isPackageTabId(id)) {
            setActiveTab(id);
          }
        }}
        ariaLabel="Final Scoping Package sections"
      >
        {(id) => {
          if (id === 'coverage') {
            return <CoverageTab session={session} />;
          }
          if (id === 'quality') {
            return <QualityTab session={session} />;
          }
          if (id === 'package') {
            return <PackagePreviewTab session={session} onOpenQualityTab={() => setActiveTab('quality')} />;
          }
          return <ChangeImpactPanel session={session} />;
        }}
      </Tabs>
    </div>
  );
}
