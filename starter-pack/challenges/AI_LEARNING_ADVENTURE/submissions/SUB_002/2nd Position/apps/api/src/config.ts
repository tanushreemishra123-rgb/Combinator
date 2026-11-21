import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCHEMA_VERSION = 1;

const appRoot = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

export interface ApiConfig {
  host: string;
  port: number;
  databaseFile: string;
  missionDataDir: string;
  corsOrigin: string;
  bodyLimitBytes: number;
  schemaVersion: number;
}

function resolvePath(value: string): string {
  return isAbsolute(value) ? value : join(appRoot, value);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const portRaw = env.API_PORT ?? env.PORT;
  let port = 4000;
  if (portRaw !== undefined && portRaw !== '') {
    port = Number(portRaw);
    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
      throw new Error(`API_PORT must be a valid port number, got "${portRaw}"`);
    }
  }
  return {
    host: env.API_HOST ?? '127.0.0.1',
    port,
    databaseFile: resolvePath(env.API_DB_FILE ?? env.DATABASE_FILE ?? join('data', 'learner.db')),
    missionDataDir: resolvePath(env.API_MISSION_DATA_DIR ?? 'mission-data'),
    corsOrigin: env.API_CORS_ORIGIN ?? '*',
    bodyLimitBytes: 256 * 1024,
    schemaVersion: SCHEMA_VERSION,
  };
}
