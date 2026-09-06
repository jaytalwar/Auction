import { auctionsService } from './auctions.service';
import { AUTO_CLOSE_POLL_INTERVAL_MS } from './anti-snipe.constants';

/**
 * Safety net, not the primary close mechanism. Every auction gets a precise
 * BullMQ delayed job scheduled for its exact `closesAt` (see
 * `auctionsService` / `queue/workers.ts`) — this poll just catches anything
 * that job missed, e.g. Redis losing delayed jobs on a restart.
 * `closeIfStillOpen` is a no-op if the auction was already settled, so it's
 * safe for both to exist and occasionally overlap.
 */
export function startAutoCloseScheduler() {
  const interval = setInterval(async () => {
    try {
      const closed = await auctionsService.closeExpiredAuctions();
      if (closed.length > 0) {
        console.log(`[scheduler] auto-closed ${closed.length} expired auction(s)`);
      }
    } catch (err) {
      console.error('[scheduler]', err);
    }
  }, AUTO_CLOSE_POLL_INTERVAL_MS);

  return interval;
}
