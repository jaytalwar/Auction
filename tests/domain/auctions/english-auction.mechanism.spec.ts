import { describe, expect, it } from 'vitest';
import { EnglishAuctionMechanism } from '@/lib/domain/auctions/mechanisms/english-auction.mechanism';
import { Bid } from '@/lib/domain/auctions/types';

describe('EnglishAuctionMechanism', () => {
  const mechanism = new EnglishAuctionMechanism();
  const ctx = { reservePrice: 100, minIncrement: 10 };

  const bid = (bidderId: string, amount: number, timestamp = 0): Bid => ({
    bidderId,
    amount,
    timestamp,
  });

  it('rejects an opening bid below the reserve price', () => {
    const result = mechanism.validateBid([], bid('alice', 50), ctx);
    expect(result.valid).toBe(false);
  });

  it('accepts an opening bid at or above the reserve price', () => {
    const result = mechanism.validateBid([], bid('alice', 100), ctx);
    expect(result.valid).toBe(true);
  });

  it('rejects a bid that does not beat the current highest by the minimum increment', () => {
    const existing = [bid('alice', 100)];
    const result = mechanism.validateBid(existing, bid('bob', 105), ctx);
    expect(result.valid).toBe(false);
  });

  it('rejects the current highest bidder from bidding again', () => {
    const existing = [bid('alice', 100)];
    const result = mechanism.validateBid(existing, bid('alice', 120), ctx);
    expect(result.valid).toBe(false);
  });

  it('accepts a bid that meets the minimum increment', () => {
    const existing = [bid('alice', 100)];
    const result = mechanism.validateBid(existing, bid('bob', 110), ctx);
    expect(result.valid).toBe(true);
  });

  it('resolves to the highest bidder paying their own bid', () => {
    const bids = [bid('alice', 100), bid('bob', 130), bid('carol', 120)];
    const result = mechanism.resolve(bids, ctx);
    expect(result).toEqual({ winnerId: 'bob', clearingPrice: 130 });
  });

  it('resolves to no winner when nothing meets the reserve', () => {
    const result = mechanism.resolve([], ctx);
    expect(result.winnerId).toBeNull();
  });
});
