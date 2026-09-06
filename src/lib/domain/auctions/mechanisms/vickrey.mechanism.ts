import { AuctionContext, AuctionMechanism, AuctionResult, Bid, BidValidation } from '../types';

/**
 * Vickrey (second-price sealed-bid) auction: every bidder submits exactly one
 * hidden bid; the highest bidder wins but pays the *second*-highest bid (or
 * the reserve price if no second bid clears it). This pricing rule makes
 * bidding your true valuation a weakly dominant strategy — see
 * tests/domain/auctions/vickrey.mechanism.spec.ts for a simulation that
 * verifies it.
 */
export class VickreyMechanism implements AuctionMechanism {
  readonly type = 'vickrey' as const;

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
    if (bids.length === 0) {
      return { winnerId: null, clearingPrice: 0 };
    }

    const sorted = [...bids].sort((a, b) => b.amount - a.amount);
    const [highest, secondHighest] = sorted;

    if (highest.amount < ctx.reservePrice) {
      return { winnerId: null, clearingPrice: 0 };
    }

    const clearingPrice = Math.max(secondHighest?.amount ?? ctx.reservePrice, ctx.reservePrice);
    return { winnerId: highest.bidderId, clearingPrice };
  }
}
