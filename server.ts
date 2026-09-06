import { loadEnvConfig } from '@next/env';

const dev = process.env.NODE_ENV !== 'production';

/**
 * Programmatic `next()` usage (as opposed to the `next` CLI) doesn't load
 * .env / .env.local on its own. This has to happen — and finish — before
 * any application module is evaluated, since several of them (the Prisma
 * client, Redis connections) read `process.env` at import time. A static
 * top-level `import` of the real server would be hoisted and evaluated
 * before the `loadEnvConfig` call below ever runs, so the actual server
 * logic lives behind a dynamic `import()` instead.
 */
loadEnvConfig(process.cwd(), dev);

import('./src/lib/server-runtime').then((m) => m.startServer(dev)).catch((err) => {
  console.error(err);
  process.exit(1);
});
