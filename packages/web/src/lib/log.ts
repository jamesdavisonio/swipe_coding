// The one place the shared browser logger is created (docs/logging.md). Everything else
// imports `log` from here and never builds its own. Identity comes from app.manifest.yaml
// through the virtual module (see vite.config.ts); event types come from the vendored
// taxonomy. `log_endpoint` is null until the client logging project exists, so events are
// buffered and dropped for now, which is expected.
import manifest from 'virtual:app-manifest'
import { initLogger } from '../../../../logging/logger.browser.js'
import taxonomy from '../../../../logging/taxonomy.json'
import piiKeys from '../../../../logging/pii-keys.json'

export const log = initLogger({ manifest, taxonomy, piiKeys, source: 'web_client' })
