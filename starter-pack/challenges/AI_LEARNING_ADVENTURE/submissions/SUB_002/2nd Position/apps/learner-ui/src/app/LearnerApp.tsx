import { Provider } from 'react-redux';
import { store } from '../store/index.ts';
import { AppBootstrap } from './AppBootstrap.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';

export function LearnerApp() {
  return (
    <Provider store={store}>
      <ErrorBoundary>
        <AppBootstrap />
      </ErrorBoundary>
    </Provider>
  );
}
