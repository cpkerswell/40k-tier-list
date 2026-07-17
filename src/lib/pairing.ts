import type { Faction } from '../types'
import { hasVotedOnPair } from './voteHistory'

const INITIAL_RANK_WINDOW = 3

function findWindowedPair(
  factionsSortedByEloDesc: Faction[],
  isEligibleIndex: (index: number) => boolean,
): [Faction, Faction] | null {
  const total = factionsSortedByEloDesc.length

  for (let window = INITIAL_RANK_WINDOW; window < total; window++) {
    const candidates: [number, number][] = []

    for (let i = 0; i < total; i++) {
      if (!isEligibleIndex(i)) continue
      for (let offset = 1; offset <= window; offset++) {
        const j = i + offset
        if (j >= total || !isEligibleIndex(j)) continue

        const factionA = factionsSortedByEloDesc[i]
        const factionB = factionsSortedByEloDesc[j]
        if (!hasVotedOnPair(factionA.id, factionB.id)) {
          candidates.push([i, j])
        }
      }
    }

    if (candidates.length > 0) {
      const [i, j] = candidates[Math.floor(Math.random() * candidates.length)]
      const pair: [Faction, Faction] = [factionsSortedByEloDesc[i], factionsSortedByEloDesc[j]]
      return Math.random() < 0.5 ? pair : [pair[1], pair[0]]
    }
  }

  return null
}

/**
 * Picks two factions close together in the current Elo ranking so votes
 * compare realistic match-ups instead of the strongest against the weakest.
 * When the caller has marked factions they know, match-ups between two known
 * factions are exhausted first; only once those run out does the full roster
 * open up. Returns null once every eligible nearby (and not-so-nearby) pair
 * has already been voted on.
 */
export function pickMatchup(
  factionsSortedByEloDesc: Faction[],
  preferredFactionIds?: Set<string>,
): [Faction, Faction] | null {
  if (factionsSortedByEloDesc.length < 2) return null

  if (preferredFactionIds && preferredFactionIds.size >= 2) {
    const preferredPair = findWindowedPair(factionsSortedByEloDesc, (index) =>
      preferredFactionIds.has(factionsSortedByEloDesc[index].id),
    )
    if (preferredPair) return preferredPair
  }

  return findWindowedPair(factionsSortedByEloDesc, () => true)
}
