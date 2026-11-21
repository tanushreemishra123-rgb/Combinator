import type { ApiConfig } from './config.ts';
import type { DatabaseHandle } from './db/client.ts';

export interface ApiContext {
  dbHandle: DatabaseHandle;
  config: ApiConfig;
}
