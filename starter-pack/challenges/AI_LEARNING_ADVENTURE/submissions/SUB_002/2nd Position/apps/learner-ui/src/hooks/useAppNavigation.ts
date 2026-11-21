import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store/index.ts';
import {
  goBack,
  goHome as goHomeAction,
  navigate as navigateToView,
  replaceView,
  selectCanGoBack,
  selectCurrentView,
  setReturnFocus,
  type LearnerView,
} from '../store/navigationSlice.ts';

export interface NavigateOptions {
  returnFocusId?: string;
}

export interface UseAppNavigationResult {
  view: LearnerView;
  navigate: (view: LearnerView, options?: NavigateOptions) => void;
  replace: (view: LearnerView) => void;
  back: () => void;
  home: () => void;
  canGoBack: boolean;
}

function resolveReturnFocusId(options?: NavigateOptions): string | undefined {
  if (options?.returnFocusId !== undefined) return options.returnFocusId;
  const active = document.activeElement;
  return active instanceof HTMLElement && active.id.length > 0 ? active.id : undefined;
}

export function useAppNavigation(): UseAppNavigationResult {
  const dispatch = useAppDispatch();
  const view = useAppSelector(selectCurrentView);
  const canGoBack = useAppSelector(selectCanGoBack);

  const navigate = useCallback(
    (next: LearnerView, options?: NavigateOptions) => {
      const returnFocusId = resolveReturnFocusId(options);
      dispatch(navigateToView(next));
      if (returnFocusId !== undefined) {
        dispatch(setReturnFocus(returnFocusId));
      }
    },
    [dispatch],
  );

  const replace = useCallback(
    (next: LearnerView) => {
      dispatch(replaceView(next));
    },
    [dispatch],
  );

  const back = useCallback(() => {
    dispatch(goBack());
  }, [dispatch]);

  const home = useCallback(() => {
    dispatch(goHomeAction());
  }, [dispatch]);

  return { view, navigate, replace, back, home, canGoBack };
}
