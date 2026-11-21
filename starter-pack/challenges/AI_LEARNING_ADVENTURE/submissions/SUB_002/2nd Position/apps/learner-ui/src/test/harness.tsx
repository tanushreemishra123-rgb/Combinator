import { render, cleanup } from '@testing-library/react';
import { Provider } from 'react-redux';
import { SWRConfig } from 'swr';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import type { CatalogDto, ProgressSnapshot } from '@ai-learning-adventure/types';
import { AppBootstrap } from '../app/AppBootstrap.tsx';
import { ErrorBoundary } from '../app/ErrorBoundary.tsx';
import { createAppStore, type AppStore } from '../store/index.ts';
import { mockLearnerApi, type MockLearnerApiOptions } from './fixtures.ts';

export const scrollIntoViewMock = vi.fn();

beforeAll(() => {
  Element.prototype.scrollIntoView = scrollIntoViewMock;
});

afterAll(() => {
  Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  scrollIntoViewMock.mockClear();
});

export interface RenderAppResult {
  store: AppStore;
  fetchMock: ReturnType<typeof mockLearnerApi>;
}

export function renderApp(
  catalog: CatalogDto,
  snapshot: ProgressSnapshot,
  options: MockLearnerApiOptions = {},
): RenderAppResult & ReturnType<typeof render> {
  const fetchMock = mockLearnerApi(catalog, snapshot, options);
  const store = createAppStore();
  const result = render(
    <Provider store={store}>
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <ErrorBoundary>
          <AppBootstrap />
        </ErrorBoundary>
      </SWRConfig>
    </Provider>,
  );
  return { store, fetchMock, ...result };
}
