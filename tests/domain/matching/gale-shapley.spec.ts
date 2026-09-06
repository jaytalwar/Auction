import { describe, expect, it } from 'vitest';
import { galeShapley, isStableMatching, Preferences } from '@/lib/domain/matching/gale-shapley';

describe('galeShapley', () => {
  it('matches every proposer when preference lists are mutually acceptable', () => {
    const proposerPrefs: Preferences = {
      a1: ['b1', 'b2', 'b3'],
      a2: ['b2', 'b1', 'b3'],
      a3: ['b1', 'b2', 'b3'],
    };
    const receiverPrefs: Preferences = {
      b1: ['a2', 'a1', 'a3'],
      b2: ['a1', 'a2', 'a3'],
      b3: ['a1', 'a2', 'a3'],
    };

    const { matches, unmatchedProposers } = galeShapley(proposerPrefs, receiverPrefs);

    expect(unmatchedProposers).toEqual([]);
    expect(Object.keys(matches)).toHaveLength(3);
    expect(isStableMatching(matches, proposerPrefs, receiverPrefs)).toBe(true);
  });

  it('produces a matching with no blocking pairs on a larger random-ish instance', () => {
    const proposerPrefs: Preferences = {
      a1: ['b3', 'b1', 'b2', 'b4'],
      a2: ['b1', 'b3', 'b2', 'b4'],
      a3: ['b2', 'b4', 'b1', 'b3'],
      a4: ['b4', 'b2', 'b3', 'b1'],
    };
    const receiverPrefs: Preferences = {
      b1: ['a2', 'a1', 'a4', 'a3'],
      b2: ['a3', 'a1', 'a2', 'a4'],
      b3: ['a1', 'a4', 'a2', 'a3'],
      b4: ['a4', 'a3', 'a1', 'a2'],
    };

    const { matches } = galeShapley(proposerPrefs, receiverPrefs);

    expect(isStableMatching(matches, proposerPrefs, receiverPrefs)).toBe(true);
  });

  it('leaves a proposer unmatched if every receiver on their list finds them unacceptable', () => {
    const proposerPrefs: Preferences = {
      a1: ['b1'],
      a2: ['b1'],
    };
    const receiverPrefs: Preferences = {
      b1: ['a1'], // a2 is not on b1's list at all — unacceptable
    };

    const { matches, unmatchedProposers } = galeShapley(proposerPrefs, receiverPrefs);

    expect(matches['a1']).toBe('b1');
    expect(unmatchedProposers).toEqual(['a2']);
  });

  it('is proposer-optimal: no proposer could do strictly better under any stable matching', () => {
    // Classic textbook instance with two stable matchings — one
    // man-optimal, one woman-optimal. Gale-Shapley with men proposing
    // must return the man-optimal one: everyone gets their first choice.
    const proposerPrefs: Preferences = {
      m1: ['w1', 'w2'],
      m2: ['w2', 'w1'],
    };
    const receiverPrefs: Preferences = {
      w1: ['m2', 'm1'],
      w2: ['m1', 'm2'],
    };

    const { matches } = galeShapley(proposerPrefs, receiverPrefs);

    expect(matches).toEqual({ m1: 'w1', m2: 'w2' });
    expect(isStableMatching(matches, proposerPrefs, receiverPrefs)).toBe(true);
  });
});

describe('isStableMatching', () => {
  it('detects an unstable matching containing a blocking pair', () => {
    const proposerPrefs: Preferences = {
      a1: ['b1', 'b2'],
      a2: ['b1', 'b2'],
    };
    const receiverPrefs: Preferences = {
      b1: ['a1', 'a2'],
      b2: ['a1', 'a2'],
    };

    // Deliberately bad matching: a2-b1 and a1-b2 both prefer swapping.
    const badMatching = { a1: 'b2', a2: 'b1' };

    expect(isStableMatching(badMatching, proposerPrefs, receiverPrefs)).toBe(false);
  });
});
