import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LearnerApp } from './app/LearnerApp.tsx';
import './styles/main.scss';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Root element "#root" was not found.');
}

createRoot(container).render(
  <StrictMode>
    <LearnerApp />
  </StrictMode>,
);
