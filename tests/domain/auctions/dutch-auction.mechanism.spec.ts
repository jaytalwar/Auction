import { describe, expect, it } from 'vitest';
import { DutchAuctionMechanism } from '@/lib/domain/auctions/mechanisms/dutch-auction.mechanism';
import { Bid } from '@/lib/domain/auctions/types';

describe('DutchAuctionMechanism', () => {
  const mechanism = new DutchAuctionMechanism();
  const ctx = { reservePrice: 50, startPrice: 200, currentClockPrice: 120 };

  const bid = (bidderId: string, amount: number): Bid => ({ bidderId, amount, timestamp: 0 });

  it('accepts a bid exactly at the current clock price', () => {
    const result = mechanism.validateBid([], bid('alice', 120), ctx);
    expect(result.valid).toBe(true);
  });

  it('rejects a bid that does not match the clock price', () => {
    const result = mechanism.validateBid([], bid('alice', 100), ctx);
    expect(result.valid).toBe(false);
  });

  it('rejects any bid once one has already been accepted', () => {
    const existing = [bid('alice', 120)];
    const result = mechanism.validateBid(existing, bid('bob', 120), ctx);
    expect(result.valid).toBe(false);
  });

  it('rejects acceptance below the reserve price', () => {
    const result = mechanism.validateBid([], bid('alice', 30), { ...ctx, currentClockPrice: 30 });
    expect(result.valid).toBe(false);
  });

  it('resolves to the single accepted bid at the clock price it was accepted at', () => {
    const result = mechanism.resolve([bid('alice', 120)], ctx);
    expect(result).toEqual({ winnerId: 'alice', clearingPrice: 120 });
  });

  it('resolves to no winner if the clock ran out with no acceptance', () => {
    const result = mechanism.resolve([], ctx);
    expect(result.winnerId).toBeNull();
  });
});
