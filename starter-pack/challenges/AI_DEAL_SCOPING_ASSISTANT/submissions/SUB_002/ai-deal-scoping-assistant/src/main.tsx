/**
 * Application entry point: mounts the React tree onto `#root` (see `index.html`) and loads the
 * global stylesheet layers once, in cascade order (tokens -> reset/utilities -> component chrome ->
 * shell layout), so every workspace and the design system share one visual language.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/shell.css';

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Root element "#root" was not found in index.html.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
