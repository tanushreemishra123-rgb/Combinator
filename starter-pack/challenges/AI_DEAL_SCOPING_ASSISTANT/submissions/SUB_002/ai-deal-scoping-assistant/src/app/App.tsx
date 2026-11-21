/**
 * Root component: wires the finished state layer, the cross-workspace navigation contract and the
 * presentational shell together (spec "Core User Journey" - the whole workflow lives in one
 * reviewable session). This is the only place those three layers meet.
 */
import type { ReactElement } from 'react';
import { AppProvider } from '../state';
import './app.css';
import { AppContent } from './AppContent';
import { NavigationProvider } from './NavigationProvider';

export function App(): ReactElement {
  return (
    <AppProvider>
      <NavigationProvider>
        <AppContent />
      </NavigationProvider>
    </AppProvider>
  );
}
