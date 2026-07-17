import type { Faction } from '../types'
import { hasVotedOnPair } from './voteHistory'

const INITIAL_RANK_WINDOW = 3

function findWindowedPair(
  factionsSortedByEloDesc: Faction[],
  isEligiblePair: (indexA: number, indexB: number) => boolean,
): [Faction, Faction] | null {
  const total = factionsSortedByEloDesc.length

  for (let window = INITIAL_RANK_WINDOW; window < total; window++) {
    const candidates: [number, number][] = []

    for (let i = 0; i < total; i++) {
      for (let offset = 1; offset <= window; offset++) {
        const j = i + offset
        if (j >= total || !isEligiblePair(i, j)) continue

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
 * Picks a fresh match-up close together in the current Elo ranking. With
 * known factions marked, three priority phases run in order: known-vs-known,
 * known-vs-anything, then anything-vs-anything (which by that point is
 * effectively unknown-vs-unknown). With no known factions at all, it's a
 * single open-pool search.
 */
export function pickMatchup(
  factionsSortedByEloDesc: Faction[],
  preferredFactionIds?: Set<string>,
): [Faction, Faction] | null {
  if (factionsSortedByEloDesc.length < 2) return null

  const preferred = preferredFactionIds
  if (preferred && preferred.size > 0) {
    const isKnown = (index: number) => preferred.has(factionsSortedByEloDesc[index].id)

    if (preferred.size >= 2) {
      const bothKnown = findWindowedPair(factionsSortedByEloDesc, (i, j) => isKnown(i) && isKnown(j))
      if (bothKnown) return bothKnown
    }

    const oneKnown = findWindowedPair(factionsSortedByEloDesc, (i, j) => isKnown(i) || isKnown(j))
    if (oneKnown) return oneKnown
  }

  return findWindowedPair(factionsSortedByEloDesc, () => true)
}

/**
 * Finds the nearest-ranked faction to `championId` that hasn't faced it yet,
 * searching outward in both rank directions at once.
 */
function findNextOpponentForChampion(
  factionsSortedByEloDesc: Faction[],
  championId: string,
): Faction | null {
  const championIndex = factionsSortedByEloDesc.findIndex((faction) => faction.id === championId)
  if (championIndex === -1) return null

  const champion = factionsSortedByEloDesc[championIndex]
  const total = factionsSortedByEloDesc.length

  for (let distance = 1; distance < total; distance++) {
    const candidateIndexes = [championIndex + distance, championIndex - distance].filter(
      (index) => index >= 0 && index < total,
    )
    const unfaced = candidateIndexes.filter(
      (index) => !hasVotedOnPair(champion.id, factionsSortedByEloDesc[index].id),
    )
    if (unfaced.length > 0) {
      const chosenIndex = unfaced[Math.floor(Math.random() * unfaced.length)]
      return factionsSortedByEloDesc[chosenIndex]
    }
  }

  return null
}

export interface MatchupSelection {
  matchup: [Faction, Faction]
  /** True when both factions are known (or the voter has no preferences at
   * all) — i.e. this round shouldn't start or continue a champion streak. */
  isBothKnown: boolean
}

/**
 * Picks the next match-up to show. If `championId` is set — the previous
 * round's winner, or carried over from a draw — the reigning faction keeps
 * facing fresh nearest-ranked opponents ("vs. the rest of the pool") until it
 * loses or runs out of challengers. Otherwise falls back to a fresh pick via
 * pickMatchup's phase order. With no known factions selected, the champion
 * mechanic never engages (isBothKnown is always reported true).
 *
 * `championSlot` places the reigning champion on the same side (0 or 1) it
 * occupied last round, so a winning streak can be clicked through without
 * moving the mouse.
 */
export function pickNextMatchup(
  factionsSortedByEloDesc: Faction[],
  preferredFactionIds: Set<string>,
  championId: string | null,
  championSlot: 0 | 1 = 0,
): MatchupSelection | null {
  const hasPreferences = preferredFactionIds.size > 0

  if (championId) {
    const champion = factionsSortedByEloDesc.find((faction) => faction.id === championId)
    const opponent = champion ? findNextOpponentForChampion(factionsSortedByEloDesc, championId) : null

    if (champion && opponent) {
      const pair: [Faction, Faction] =
        championSlot === 0 ? [champion, opponent] : [opponent, champion]
      return {
        matchup: pair,
        isBothKnown:
          !hasPreferences ||
          (preferredFactionIds.has(champion.id) && preferredFactionIds.has(opponent.id)),
      }
    }
  }

  const fresh = pickMatchup(factionsSortedByEloDesc, preferredFactionIds)
  if (!fresh) return null

  return {
    matchup: fresh,
    isBothKnown:
      !hasPreferences ||
      (preferredFactionIds.has(fresh[0].id) && preferredFactionIds.has(fresh[1].id)),
  }
}
