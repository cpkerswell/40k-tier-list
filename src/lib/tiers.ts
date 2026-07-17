import type { Faction, Tier } from '../types'

export const TIER_ORDER: Tier[] = ['S', 'A', 'B', 'C', 'D']

const TIER_CUTOFFS: { tier: Tier; percentile: number }[] = [
  { tier: 'S', percentile: 0.1 },
  { tier: 'A', percentile: 0.3 },
  { tier: 'B', percentile: 0.7 },
  { tier: 'C', percentile: 0.9 },
  { tier: 'D', percentile: 1 },
]

/**
 * Buckets factions into S/A/B/C/D by rank percentile rather than fixed Elo
 * thresholds, so tiers stay populated regardless of the overall rating spread.
 */
export function assignTiers(factionsSortedByEloDesc: Faction[]): Map<string, Tier> {
  const total = factionsSortedByEloDesc.length
  const tierByFactionId = new Map<string, Tier>()

  factionsSortedByEloDesc.forEach((faction, index) => {
    const percentile = (index + 1) / total
    const cutoff = TIER_CUTOFFS.find((entry) => percentile <= entry.percentile)
    tierByFactionId.set(faction.id, cutoff ? cutoff.tier : 'D')
  })

  return tierByFactionId
}
