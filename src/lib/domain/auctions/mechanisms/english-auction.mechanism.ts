import { AuctionContext, AuctionMechanism, AuctionResult, Bid, BidValidation } from '../types';

/**
 * English (open ascending) auction: bidders openly outbid each other; each
 * new bid must beat the current highest by at least `minIncrement`. Highest
 * bidder wins and pays exactly what they bid.
 */
export class EnglishAuctionMechanism implements AuctionMechanism {
  readonly type = 'english' as const;

  validateBid(existingBids: Bid[], incoming: Bid, ctx: AuctionContext): BidValidation {
    const increment = ctx.minIncrement ?? 1;
    const currentHighest = this.highestBid(existingBids);

    if (currentHighest === null) {
      if (incoming.amount < ctx.reservePrice) {
        return { valid: false, reason: 'Bid is below the reserve price.' };
      }
      return { valid: true };
    }

    if (incoming.bidderId === currentHighest.bidderId) {
      return { valid: false, reason: 'You already hold the highest bid.' };
    }

    if (incoming.amount < currentHighest.amount + increment) {
      return {
        valid: false,
        reason: `Bid must be at least ${currentHighest.amount + increment}.`,
      };
    }

    return { valid: true };
  }

  resolve(bids: Bid[], ctx: AuctionContext): AuctionResult {
    const highest = this.highestBid(bids);
    if (!highest || highest.amount < ctx.reservePrice) {
      return { winnerId: null, clearingPrice: 0 };
    }
    return { winnerId: highest.bidderId, clearingPrice: highest.amount };
  }

  private highestBid(bids: Bid[]): Bid | null {
    if (bids.length === 0) return null;
    return bids.reduce((max, b) => (b.amount > max.amount ? b : max), bids[0]);
  }
}
