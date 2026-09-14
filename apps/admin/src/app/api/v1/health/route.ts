import { ok, route } from '@/lib/http';
import { env } from '@/lib/env';

export const GET = route(async (_req, _ctx, requestId) => {
  return ok({ status: 'ok', dataMode: env.dataMode(), version: 'v1', requestId }, requestId);
});
