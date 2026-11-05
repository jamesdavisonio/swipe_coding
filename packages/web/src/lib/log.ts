// The one place the shared browser logger is created (docs/logging.md). Everything else
// imports `log` from here and never builds its own. Identity comes from app.manifest.yaml
// through the virtual module (see vite.config.ts); event types come from the vendored
// taxonomy. Batches go to the board's log store (lib/log-store.ts) through the logger's
// `transport`, which is used whether or not `log_endpoint` is set.
import manifest from 'virtual:app-manifest'
import { initLogger } from '../../../../logging/logger.browser.js'
import taxonomy from '../../../../logging/taxonomy.json'
import piiKeys from '../../../../logging/pii-keys.json'
import { storeLogEvents } from './log-store.ts'

export const log = initLogger({
  manifest,
  taxonomy,
  piiKeys,
  source: 'web_client',
  transport: storeLogEvents,
})
