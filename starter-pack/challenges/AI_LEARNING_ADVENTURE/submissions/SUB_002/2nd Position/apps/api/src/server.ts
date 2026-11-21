import { createServer } from 'node:http';
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';

const config = loadConfig();
const app = createApp(config);
const server = createServer(app.handler);

server.listen(config.port, config.host, () => {
  const seed = app.seedResult;
  console.log(`[api] listening on http://${config.host}:${config.port}`);
  console.log(`[api] database file: ${config.databaseFile}`);
  console.log(
    seed.seeded
      ? `[api] seeded content: ${seed.missions} missions, ${seed.questions} questions, ${seed.flashcards} flashcards, ${seed.awards} awards`
      : `[api] content already present: ${seed.missions} missions`,
  );
});

let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[api] ${signal} received, shutting down`);
  server.close(() => {
    app.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
