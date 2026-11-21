import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { ErrorBoundary } from './ErrorBoundary';
import { HomeScreen } from './HomeScreen';
import { HumanReviewModal } from './HumanReviewModal';
import { PuzzleScreen } from './PuzzleScreen';
import { ReviewerGuide } from './ReviewerGuide';
import { SettingsModal } from './SettingsModal';

function Toast() {
  const toast = useStore((s) => s.toast);
  const dismissToast = useStore((s) => s.dismissToast);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(dismissToast, 4200);
    return () => clearTimeout(timer);
  }, [toast, dismissToast]);
  if (!toast) return null;
  return (
    <div className="toast" role="status" aria-live="polite" onClick={dismissToast}>
      {toast}
    </div>
  );
}

/**
 * The whole app is "watch a run and read the verdict", which is invisible to a
 * screen reader when the only signal is colour and a chip changing. This narrates
 * the two moments that matter: the run starting, and the score it landed on.
 */
function RunAnnouncer() {
  const running = useStore((s) => s.running);
  const humanGate = useStore((s) => s.humanGate);
  const scored = useStore((s) => (s.screen.name === 'puzzle' ? s.scored[s.screen.puzzleId] : undefined));
  const [message, setMessage] = useState('');
  const wasRunning = useRef(false);

  useEffect(() => {
    if (running && !wasRunning.current) setMessage('Workflow running.');
    if (!running && wasRunning.current && scored) {
      setMessage(
        `Run finished. Score ${scored.assessment.score} out of 100, ${scored.assessment.verdict}.`,
      );
    }
    wasRunning.current = running;
  }, [running, scored]);

  useEffect(() => {
    if (humanGate) setMessage(`Paused for human review: ${humanGate.prompt.title}. Approve, edit, or reject.`);
  }, [humanGate]);

  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  );
}

function Celebration() {
  const celebrate = useStore((s) => s.celebrate);
  const clearCelebration = useStore((s) => s.clearCelebration);
  useEffect(() => {
    if (!celebrate) return;
    const timer = setTimeout(clearCelebration, 4000);
    return () => clearTimeout(timer);
  }, [celebrate, clearCelebration]);
  if (!celebrate) return null;
  return (
    <div className="celebration">
      <div className="celebration-banner">🎉 Puzzle solved! Every completion goal is met.</div>
      {Array.from({ length: 36 }).map((_, i) => (
        <span
          key={i}
          className="confetti"
          style={{
            left: `${(i * 137) % 100}%`,
            animationDelay: `${(i % 12) * 0.12}s`,
            background: ['#ffb454', '#4da3ff', '#4ade80', '#b07bff', '#ff6b8a'][i % 5],
          }}
        />
      ))}
    </div>
  );
}

export function App() {
  const screen = useStore((s) => s.screen.name);
  return (
    <ErrorBoundary>
      {screen === 'home' ? <HomeScreen /> : <PuzzleScreen />}
      <HumanReviewModal />
      <ReviewerGuide />
      <SettingsModal />
      <RunAnnouncer />
      <Toast />
      <Celebration />
    </ErrorBoundary>
  );
}
