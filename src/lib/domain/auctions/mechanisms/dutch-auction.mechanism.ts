import { AuctionContext, AuctionMechanism, AuctionResult, Bid, BidValidation } from '../types';

/**
 * Dutch (open descending) auction: the price starts high and ticks down over
 * time. The first bidder to accept the current clock price wins immediately
 * at that price — there is only ever one valid bid.
 */
export class DutchAuctionMechanism implements AuctionMechanism {
  readonly type = 'dutch' as const;

  validateBid(existingBids: Bid[], incoming: Bid, ctx: AuctionContext): BidValidation {
    if (existingBids.length > 0) {
      return { valid: false, reason: 'Auction already closed — a bid was already accepted.' };
    }

    const clockPrice = ctx.currentClockPrice ?? ctx.startPrice;
    if (clockPrice === undefined) {
      return { valid: false, reason: 'No active clock price to accept.' };
    }

    if (incoming.amount !== clockPrice) {
      return { valid: false, reason: `Must accept at the current clock price of ${clockPrice}.` };
    }

    if (clockPrice < ctx.reservePrice) {
      return { valid: false, reason: 'Clock price has fallen below the reserve price.' };
    }

    return { valid: true };
  }

  resolve(bids: Bid[], _ctx: AuctionContext): AuctionResult {
    if (bids.length === 0) {
      return { winnerId: null, clearingPrice: 0 };
    }
    const accepted = bids[0];
    return { winnerId: accepted.bidderId, clearingPrice: accepted.amount };
  }
}
