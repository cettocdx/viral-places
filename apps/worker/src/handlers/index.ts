import { postExtract } from './extract.ts';
import { importProcess, maintenanceDaily } from './import-maintenance.ts';
import { ingestProviderEvent, metricsRefresh, pollAccount, pollDispatch } from './poll.ts';
import { mentionResolve } from './resolve.ts';
import type { Handler } from './types.ts';
import { cohortsBuild, venueRefresh } from './venue.ts';

export const HANDLERS: Record<string, Handler> = {
  'poll.dispatch': pollDispatch,
  'poll.account': pollAccount,
  'metrics.refresh': metricsRefresh,
  'ingest.provider_event': ingestProviderEvent,
  'post.extract': postExtract,
  'mention.resolve': mentionResolve,
  'venue.refresh': venueRefresh,
  'cohorts.build': cohortsBuild,
  'import.process': importProcess,
  'maintenance.daily': maintenanceDaily,
};
export const JOB_KINDS = Object.keys(HANDLERS);
