import { Worker } from 'bullmq';
import { createBullRedisOptions } from '../redis';
import { auctionsService, CloseAuctionJobData, PlaceBidJobData } from '../auctions.service';
import { AUCTION_CLOSING_QUEUE, BID_QUEUE } from './queue.constants';

/**
 * Started once, from server.ts, when the process boots.
 *
 * `concurrency: 1` on the bid worker is deliberate — it's what makes bid
 * processing serialized across the whole system, so two bids racing for the
 * same auction can't both read the same "current highest bid" and both get
 * accepted. The tradeoff is bids for *different* auctions also can't
 * process in parallel; fixing that would mean sharding by auctionId across
 * multiple queues/workers, a reasonable next step once a single worker is
 * actually the bottleneck, not before.
 */
export function startWorkers() {
  const bidWorker = new Worker<PlaceBidJobData>(
    BID_QUEUE,
    (job) => auctionsService.executeBidJob(job.data),
    { connection: createBullRedisOptions(), concurrency: 1 },
  );

  /**
   * One delayed job per auction, scheduled to fire at exactly `closesAt`
   * (rescheduled on every anti-snipe extension). `closeIfStillOpen` is a
   * no-op if the auction was already settled some other way (manual close,
   * or the scheduler.ts safety-net poll beat this job to it), so it's safe
   * for both to exist.
   */
  const closingWorker = new Worker<CloseAuctionJobData>(
    AUCTION_CLOSING_QUEUE,
    (job) => auctionsService.closeIfStillOpen(job.data.auctionId),
    { connection: createBullRedisOptions() },
  );

  bidWorker.on('error', (err) => console.error('[bid-worker]', err));
  closingWorker.on('error', (err) => console.error('[closing-worker]', err));

  return { bidWorker, closingWorker };
}
