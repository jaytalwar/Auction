import { describe, expect, it } from 'vitest';
import { VickreyMechanism } from '@/lib/domain/auctions/mechanisms/vickrey.mechanism';
import { Bid } from '@/lib/domain/auctions/types';

const bid = (bidderId: string, amount: number): Bid => ({ bidderId, amount, timestamp: 0 });

describe('VickreyMechanism — resolution', () => {
  const mechanism = new VickreyMechanism();

  it('winner pays exactly the second-highest bid, not their own', () => {
    const bids = [bid('alice', 300), bid('bob', 500), bid('carol', 450)];
    const result = mechanism.resolve(bids, { reservePrice: 0 });
    expect(result).toEqual({ winnerId: 'bob', clearingPrice: 450 });
  });

  it('falls back to the reserve price when there is only one bid', () => {
    const result = mechanism.resolve([bid('alice', 300)], { reservePrice: 100 });
    expect(result).toEqual({ winnerId: 'alice', clearingPrice: 100 });
  });

  it('has no winner when the highest bid is below the reserve price', () => {
    const result = mechanism.resolve([bid('alice', 80)], { reservePrice: 100 });
    expect(result.winnerId).toBeNull();
  });
});

/**
 * The defining property of a second-price sealed-bid auction: bidding your
 * true valuation is a weakly dominant strategy. Shading your bid up or down
 * never produces a strictly better payoff, no matter what everyone else
 * bids. This is what makes Vickrey theoretically interesting versus
 * first-price sealed-bid, where bidders must strategize based on beliefs
 * about opponents.
 *
 * We don't just assert this in the abstract — we simulate it against many
 * randomized opponent bid vectors and check the inequality holds for every
 * single one, which is the actual proof technique (dominance must hold
 * pointwise over all opponent strategies, not just in expectation).
 */
describe('VickreyMechanism — truthful bidding is dominant', () => {
  const mechanism = new VickreyMechanism();
  const trueValue = 500;
  const reservePrice = 0;

  function payoff(myBid: number, opponentBids: number[]): number {
    const bids: Bid[] = [bid('me', myBid), ...opponentBids.map((amount, i) => bid(`opp${i}`, amount))];
    const result = mechanism.resolve(bids, { reservePrice });
    if (result.winnerId !== 'me') return 0;
    return trueValue - result.clearingPrice;
  }

  // Deterministic LCG so the simulation is reproducible across CI runs.
  function makeRng(seed: number) {
    let state = seed;
    return () => {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      return state / 0x7fffffff;
    };
  }

  it('never yields a strictly worse payoff than shading up or down, across randomized opponents', () => {
    const rng = makeRng(42);
    const strategies = [
      trueValue - 200,
      trueValue - 100,
      trueValue - 20,
      trueValue + 20,
      trueValue + 100,
      trueValue + 200,
    ].filter((v) => v > 0);

    for (let trial = 0; trial < 500; trial++) {
      const numOpponents = 1 + Math.floor(rng() * 4);
      const opponentBids = Array.from({ length: numOpponents }, () => Math.floor(rng() * 1000));

      const truthfulPayoff = payoff(trueValue, opponentBids);

      for (const strategy of strategies) {
        expect(truthfulPayoff).toBeGreaterThanOrEqual(payoff(strategy, opponentBids));
      }
    }
  });
});
