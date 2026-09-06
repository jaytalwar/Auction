import { Queue, QueueEvents } from 'bullmq';
import { createBullRedisOptions } from '../redis';
import { AUCTION_CLOSING_QUEUE, BID_QUEUE } from './queue.constants';
import type { CloseAuctionJobData, PlaceBidJobData } from '../auctions.service';

interface QueueSingletons {
  bidQueue: Queue<PlaceBidJobData>;
  closingQueue: Queue<CloseAuctionJobData>;
  bidQueueEvents: QueueEvents;
}

const globalForQueues = globalThis as unknown as { __auctionQueues?: QueueSingletons };

function build(): QueueSingletons {
  const connection = createBullRedisOptions();
  const bidQueue = new Queue<PlaceBidJobData>(BID_QUEUE, { connection });
  const closingQueue = new Queue<CloseAuctionJobData>(AUCTION_CLOSING_QUEUE, { connection });
  /**
   * `job.waitUntilFinished()` needs a `QueueEvents` instance that's already
   * subscribed *before* the job completes, or the completion event can fire
   * before anyone's listening and the wait hangs until its timeout. A
   * module-level singleton (rather than one per request) avoids that race.
   */
  const bidQueueEvents = new QueueEvents(BID_QUEUE, { connection: createBullRedisOptions() });
  return { bidQueue, closingQueue, bidQueueEvents };
}

const queues = globalForQueues.__auctionQueues ?? build();

if (process.env.NODE_ENV !== 'production') {
  globalForQueues.__auctionQueues = queues;
}

export const { bidQueue, closingQueue, bidQueueEvents } = queues;
