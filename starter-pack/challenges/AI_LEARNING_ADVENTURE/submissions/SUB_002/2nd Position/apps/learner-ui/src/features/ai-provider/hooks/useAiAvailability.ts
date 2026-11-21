import { useAppDispatch, useAppSelector } from '../../../store/index.ts';
import { selectAiAvailability, selectShouldShowAiBanner } from '../../../store/aiSlice.ts';
import { dismissAiBanner } from '../../../store/preferencesSlice.ts';

export function useAiAvailability() {
  const dispatch = useAppDispatch();
  const availability = useAppSelector(selectAiAvailability);
  const showBanner = useAppSelector(selectShouldShowAiBanner);
  return {
    ...availability,
    showBanner,
    bannerMessage:
      availability.status === 'error'
        ? 'AI connection failed. Sample responses are active.'
        : availability.status === 'mock'
          ? 'Mock mode is active. You are seeing sample responses.'
          : availability.status === 'unknown' || availability.status === 'testing'
            ? 'AI is not connected yet. Sample responses remain available.'
            : 'AI is not configured. You are seeing sample responses.',
    inlineMessage:
      availability.status === 'error'
        ? 'The live provider failed. This response uses a safe sample instead.'
        : 'AI setup is required for personalized answers. Sample responses are available now.',
    dismissForSession: () => dispatch(dismissAiBanner()),
  };
}
