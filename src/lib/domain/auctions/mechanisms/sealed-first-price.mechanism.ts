import { AuctionContext, AuctionMechanism, AuctionResult, Bid, BidValidation } from '../types';

/**
 * Sealed-bid first-price auction: every bidder submits exactly one hidden
 * bid; the highest bid wins and pays their own bid amount. Rational bidders
 * shade their bid below true value here, unlike Vickrey.
 */
export class SealedFirstPriceMechanism implements AuctionMechanism {
  readonly type = 'sealed-first-price' as const;

  validateBid(existingBids: Bid[], incoming: Bid, _ctx: AuctionContext): BidValidation {
    const alreadyBid = existingBids.some((b) => b.bidderId === incoming.bidderId);
    if (alreadyBid) {
      return { valid: false, reason: 'Only one sealed bid is allowed per bidder.' };
    }
    if (incoming.amount <= 0) {
      return { valid: false, reason: 'Bid must be positive.' };
    }
    return { valid: true };
  }

  resolve(bids: Bid[], ctx: AuctionContext): AuctionResult {
    const eligible = bids.filter((b) => b.amount >= ctx.reservePrice);
    if (eligible.length === 0) {
      return { winnerId: null, clearingPrice: 0 };
    }
    const winner = eligible.reduce((max, b) => (b.amount > max.amount ? b : max), eligible[0]);
    return { winnerId: winner.bidderId, clearingPrice: winner.amount };
  }
}
