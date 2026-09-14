import type { AdapterRegistry } from '../adapters.ts';
import type { Db, JobRow } from '../db.ts';
import type { PipelinePolicyFile } from '../env.ts';

export interface Ctx {
  db: Db;
  adapters: AdapterRegistry;
  policy: PipelinePolicyFile;
  now: () => string;
  log: (level: 'info' | 'warn' | 'error', msg: string, fields?: Record<string, unknown>) => void;
  dataMode: 'demo' | 'live';
}

export type HandlerResult = { ok: true; note?: string } | { ok: false; code: string; detail?: string; retryAfterSeconds: number | null };

export type Handler = (ctx: Ctx, job: JobRow) => Promise<HandlerResult>;

export const RETRY = { transient: 120, provider: 600, none: null } as const;
