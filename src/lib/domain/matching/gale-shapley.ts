/**
 * Ranked preference lists, most preferred first. An id absent from another
 * party's list is treated as unacceptable to that party.
 */
export type Preferences = Record<string, string[]>;

export interface MatchResult {
  /** proposer id -> matched receiver id */
  matches: Record<string, string>;
  unmatchedProposers: string[];
}

function rank(prefs: string[] | undefined, id: string): number {
  if (!prefs) return Infinity;
  const idx = prefs.indexOf(id);
  return idx === -1 ? Infinity : idx;
}

/**
 * Gale-Shapley deferred acceptance algorithm. Proposers propose down their
 * preference list; receivers tentatively hold the best offer seen so far and
 * bump a held proposer if a better one arrives. Terminates with a matching
 * that is always stable and is optimal for the proposing side.
 */
export function galeShapley(proposerPrefs: Preferences, receiverPrefs: Preferences): MatchResult {
  const proposers = Object.keys(proposerPrefs);
  const nextProposal: Record<string, number> = {};
  proposers.forEach((p) => (nextProposal[p] = 0));

  const receiverToProposer: Record<string, string> = {};
  const free: string[] = [...proposers];

  while (free.length > 0) {
    const p = free.shift()!;
    const prefs = proposerPrefs[p] ?? [];

    if (nextProposal[p] >= prefs.length) {
      continue; // exhausted their list — stays unmatched
    }

    const r = prefs[nextProposal[p]];
    nextProposal[p] += 1;

    const receiverPrefList = receiverPrefs[r];
    const proposerRank = rank(receiverPrefList, p);
    if (proposerRank === Infinity) {
      free.push(p); // receiver finds p unacceptable, p tries its next choice
      continue;
    }

    const currentPartner = receiverToProposer[r];
    if (!currentPartner) {
      receiverToProposer[r] = p;
    } else if (proposerRank < rank(receiverPrefList, currentPartner)) {
      receiverToProposer[r] = p;
      free.push(currentPartner);
    } else {
      free.push(p);
    }
  }

  const matches: Record<string, string> = {};
  Object.entries(receiverToProposer).forEach(([r, p]) => {
    matches[p] = r;
  });

  const unmatchedProposers = proposers.filter((p) => !(p in matches));

  return { matches, unmatchedProposers };
}

/**
 * Verifies a matching has no blocking pair: no proposer/receiver who both
 * prefer each other over their assigned partners. This is the formal
 * definition of stability that Gale-Shapley guarantees.
 */
export function isStableMatching(
  matches: Record<string, string>,
  proposerPrefs: Preferences,
  receiverPrefs: Preferences,
): boolean {
  const receiverPartnerOf: Record<string, string> = {};
  Object.entries(matches).forEach(([p, r]) => {
    receiverPartnerOf[r] = p;
  });

  for (const proposer of Object.keys(proposerPrefs)) {
    const partner = matches[proposer];
    const proposerPartnerRank = partner ? rank(proposerPrefs[proposer], partner) : Infinity;

    for (const candidateReceiver of proposerPrefs[proposer] ?? []) {
      const candidateRank = rank(proposerPrefs[proposer], candidateReceiver);
      if (candidateRank >= proposerPartnerRank) break; // no more preferred candidates remain

      const receiverCurrentPartner = receiverPartnerOf[candidateReceiver];
      const receiverPartnerRank = receiverCurrentPartner
        ? rank(receiverPrefs[candidateReceiver], receiverCurrentPartner)
        : Infinity;
      const receiverProposerRank = rank(receiverPrefs[candidateReceiver], proposer);

      if (receiverProposerRank < receiverPartnerRank) {
        return false; // blocking pair: both would rather be with each other
      }
    }
  }

  return true;
}
