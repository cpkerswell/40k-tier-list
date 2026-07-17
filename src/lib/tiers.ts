import type { Tier } from '../types'

export const TIER_ORDER: Tier[] = ['S', 'A', 'B', 'C', 'D']

const TIER_CUTOFFS: { tier: Tier; percentile: number }[] = [
  { tier: 'S', percentile: 0.1 },
  { tier: 'A', percentile: 0.3 },
  { tier: 'B', percentile: 0.7 },
  { tier: 'C', percentile: 0.9 },
  { tier: 'D', percentile: 1 },
]

export interface RankableEntry {
  id: string
  elo_rating: number
}

/**
 * Buckets entries into S/A/B/C/D by rank percentile rather than fixed Elo
 * thresholds, so tiers stay populated regardless of the overall rating
 * spread. Generic over anything with an id + elo_rating, so it works both
 * for whole factions and for faction+disposition breakdown rows.
 */
export function assignTiers<T extends RankableEntry>(entriesSortedByEloDesc: T[]): Map<string, Tier> {
  const total = entriesSortedByEloDesc.length
  const tierById = new Map<string, Tier>()

  entriesSortedByEloDesc.forEach((entry, index) => {
    const percentile = (index + 1) / total
    const cutoff = TIER_CUTOFFS.find((c) => percentile <= c.percentile)
    tierById.set(entry.id, cutoff ? cutoff.tier : 'D')
  })

  return tierById
}
