import { createServer } from 'node:http';
import next from 'next';
import { createSocketServer } from './socket-server';
import { startWorkers } from './queue/workers';
import { startAutoCloseScheduler } from './scheduler';
import { registerNotificationsListener } from './notifications-listener';

const port = Number(process.env.PORT) || 3000;

export async function startServer(dev: boolean) {
  const app = next({ dev });
  const handle = app.getRequestHandler();

  await app.prepare();

  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  await createSocketServer(httpServer);

  // Wires auction.bid.outbid / auction.closed events into persisted,
  // per-user notifications — must be registered before any bids can land.
  registerNotificationsListener();

  // Bid processing (concurrency 1, serializes the race condition) and
  // scheduled auction closing both run in-process, same as the rest of the
  // app — there's only one Node process here.
  startWorkers();
  startAutoCloseScheduler();

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
}
