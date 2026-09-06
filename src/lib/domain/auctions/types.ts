export interface Bid {
  bidderId: string;
  amount: number;
  timestamp: number;
}

export interface AuctionContext {
  reservePrice: number;
  /** English auctions: minimum amount a new bid must exceed the current highest by. */
  minIncrement?: number;
  /** Dutch auctions: price the clock starts at and descends from. */
  startPrice?: number;
  /** Dutch auctions: price the clock is currently at when a bid arrives. */
  currentClockPrice?: number;
}

export interface BidValidation {
  valid: boolean;
  reason?: string;
}

export interface AuctionResult {
  winnerId: string | null;
  /** Price the winner actually pays — mechanism-dependent (own bid vs. second-highest, etc). */
  clearingPrice: number;
}

export type AuctionMechanismType = 'english' | 'dutch' | 'sealed-first-price' | 'vickrey';

/**
 * A pricing/allocation rule, independent of transport (WebSocket, REST, etc).
 * Every mechanism must define how an incoming bid is validated against the
 * bids seen so far, and how a closed auction's bid history resolves into a
 * single winner + clearing price.
 */
export interface AuctionMechanism {
  readonly type: AuctionMechanismType;

  validateBid(existingBids: Bid[], incoming: Bid, ctx: AuctionContext): BidValidation;

  resolve(bids: Bid[], ctx: AuctionContext): AuctionResult;
}
