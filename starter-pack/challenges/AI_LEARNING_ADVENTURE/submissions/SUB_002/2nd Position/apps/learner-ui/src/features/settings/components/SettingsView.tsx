import { useEffect } from 'react';
import { useAppDispatch } from '../../../store/index.ts';
import { closeTutor } from '../../../store/aiSlice.ts';
import { AiProviderSettingsCard } from '../../ai-provider/components/AiProviderSettingsCard.tsx';

export function SettingsView() {
  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(closeTutor());
    document.getElementById('ai-provider-heading')?.focus({ preventScroll: true });
  }, [dispatch]);
  return (
    <div className="settings-view">
      <header className="settings-view__header">
        <div>
          <p className="ai-eyebrow">Application setup</p>
          <h1>Settings</h1>
          <p>Choose how AI learning support runs on this device.</p>
        </div>
      </header>
      <AiProviderSettingsCard />
    </div>
  );
}
