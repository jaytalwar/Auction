import { describe, expect, it } from 'vitest';
import { SealedFirstPriceMechanism } from '@/lib/domain/auctions/mechanisms/sealed-first-price.mechanism';
import { Bid } from '@/lib/domain/auctions/types';

describe('SealedFirstPriceMechanism', () => {
  const mechanism = new SealedFirstPriceMechanism();
  const ctx = { reservePrice: 50 };

  const bid = (bidderId: string, amount: number): Bid => ({ bidderId, amount, timestamp: 0 });

  it('rejects a second bid from the same bidder', () => {
    const existing = [bid('alice', 80)];
    const result = mechanism.validateBid(existing, bid('alice', 90), ctx);
    expect(result.valid).toBe(false);
  });

  it('resolves to the highest bidder paying exactly their own bid', () => {
    const bids = [bid('alice', 80), bid('bob', 120), bid('carol', 110)];
    const result = mechanism.resolve(bids, ctx);
    expect(result).toEqual({ winnerId: 'bob', clearingPrice: 120 });
  });

  it('excludes bids below the reserve price from winning', () => {
    const bids = [bid('alice', 30)];
    const result = mechanism.resolve(bids, ctx);
    expect(result.winnerId).toBeNull();
  });
});
