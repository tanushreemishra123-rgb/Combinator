/**
 * Application shell: a permanent sidebar column beside the content at >= 1100px; below that the
 * sidebar is reached through a drawer opened from a menu button in the mobile/tablet top bar (the
 * spec's '700-1100px collapsible sidebar' and '< 700px top bar with a step drawer' breakpoints -
 * see src/styles/shell.css for the widths). Purely presentational: `sidebar` and `header` are
 * whatever the caller renders (typically `<Sidebar>` and `<HeaderBar>`).
 */
import { useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Drawer, IconButton } from '../common';
import { MenuIcon } from '../common/icons';

export interface AppLayoutProps {
  sidebar: ReactNode;
  header: ReactNode;
  children: ReactNode;
  notices?: ReactNode;
}

export function AppLayout({ sidebar, header, children, notices }: AppLayoutProps): ReactElement {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <div className="app-shell-sidebar" data-surface="dark">
        {sidebar}
      </div>
      <div className="app-shell-main">
        <div className="app-topbar">
          <IconButton
            label="Open navigation"
            icon={<MenuIcon />}
            variant="ghost"
            className="app-topbar-menu"
            aria-expanded={navOpen}
            aria-controls="app-mobile-nav"
            onClick={() => setNavOpen(true)}
          />
          <div className="app-topbar-header">{header}</div>
        </div>
        {notices ? <div className="app-shell-notices">{notices}</div> : null}
        <main id="main-content" className="app-shell-content">
          {children}
        </main>
      </div>
      <Drawer open={navOpen} title="Navigation" onClose={() => setNavOpen(false)}>
        <div data-surface="dark" className="app-mobile-nav-sidebar">
          {sidebar}
        </div>
      </Drawer>
    </div>
  );
}
