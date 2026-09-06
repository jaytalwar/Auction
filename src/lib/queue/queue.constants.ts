/**
 * Every bid — regardless of which auction it's for — goes through this one
 * queue with worker concurrency 1, so bids are processed strictly one at a
 * time. That's what actually eliminates the race where two concurrent bids
 * both read the same "current highest bid" and both get accepted. The
 * tradeoff is bids across *different* auctions can't process in parallel;
 * sharding by auctionId across multiple queues/workers would fix that at
 * scale.
 */
export const BID_QUEUE = 'bid-processing';

/**
 * One delayed job per open auction, scheduled to fire exactly at closesAt
 * (and rescheduled on every anti-snipe extension). The interval-poll
 * scheduler stays in place as a safety net, not the primary mechanism —
 * see scheduler.ts.
 */
export const AUCTION_CLOSING_QUEUE = 'auction-closing';

export const PLACE_BID_JOB = 'place-bid';
export const CLOSE_AUCTION_JOB = 'close-auction';

/** How long placeBid() waits for the queued job before giving up. */
export const BID_JOB_TIMEOUT_MS = 15_000;
