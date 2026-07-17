// The five Force Dispositions from Warhammer 40k 11th edition. Every
// detachment is assigned one, so any faction can reasonably be tagged with
// any of them -- rather than hardcode which apply to which faction (still
// being rolled out faction-pack by faction-pack), the ranking view decides
// per-faction whether to split by disposition based on actual usage.
export const DISPOSITIONS = [
  'Take and Hold',
  'Purge the Foe',
  'Reconnaissance',
  'Disruption',
  'Priority Assets',
] as const

export type Disposition = (typeof DISPOSITIONS)[number]

export function isDisposition(value: string): value is Disposition {
  return (DISPOSITIONS as readonly string[]).includes(value)
}

function taggingStorageKey(groupSlug: string): string {
  return `40k-tier-list:${groupSlug}:faction-dispositions`
}

function readFactionDispositions(groupSlug: string): Record<string, Disposition[]> {
  try {
    const raw = localStorage.getItem(taggingStorageKey(groupSlug))
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, Disposition[]>) : {}
  } catch {
    return {}
  }
}

function writeFactionDispositions(groupSlug: string, map: Record<string, Disposition[]>): void {
  localStorage.setItem(taggingStorageKey(groupSlug), JSON.stringify(map))
}

export function getDispositionsForFaction(groupSlug: string, factionId: string): Disposition[] {
  return readFactionDispositions(groupSlug)[factionId] ?? []
}

export function toggleFactionDisposition(
  groupSlug: string,
  factionId: string,
  disposition: Disposition,
): Disposition[] {
  const map = readFactionDispositions(groupSlug)
  const current = map[factionId] ?? []
  const next = current.includes(disposition)
    ? current.filter((d) => d !== disposition)
    : [...current, disposition]

  if (next.length > 0) {
    map[factionId] = next
  } else {
    delete map[factionId]
  }
  writeFactionDispositions(groupSlug, map)
  return next
}

export function pickRandomDisposition(dispositions: Disposition[]): Disposition | null {
  if (dispositions.length === 0) return null
  return dispositions[Math.floor(Math.random() * dispositions.length)]
}

// Shared thresholds for "is this disposition data meaningful", used by both
// the Tiers by-disposition view and the Matchup Matrix so both agree on what
// counts as a real signal versus a stray vote or a coin-flip.
export const MIN_GAMES_FOR_DISPOSITION_SIGNAL = 3
export const DISPOSITION_ELO_GAP = 75

interface DispositionRatingLike {
  elo_rating: number
  games_played: number
}

/** Dispositions with enough votes to be meaningful signal, best-rated first. */
export function significantDispositions<T extends DispositionRatingLike>(ratings: T[]): T[] {
  return [...ratings]
    .filter((rating) => rating.games_played >= MIN_GAMES_FOR_DISPOSITION_SIGNAL)
    .sort((a, b) => b.elo_rating - a.elo_rating)
}

/**
 * The single disposition that clearly represents a faction right now: the
 * best-rated one, provided it isn't just barely ahead in a close/ambiguous
 * field. Returns null when there's no significant data, or when the top two
 * significant dispositions are too close together to call a clear winner.
 */
export function findClearDisposition<T extends DispositionRatingLike>(ratings: T[]): T | null {
  const significant = significantDispositions(ratings)
  if (significant.length === 0) return null
  if (significant.length === 1) return significant[0]
  const gap = significant[0].elo_rating - significant[1].elo_rating
  return gap >= DISPOSITION_ELO_GAP ? significant[0] : null
}

const SHOW_DISPOSITIONS_KEY = '40k-tier-list:show-dispositions'

/** Global (not per-group) — this is about how you like to see the app.
 * Off by default; opt in via the header toggle. */
export function getShowDispositions(): boolean {
  try {
    return localStorage.getItem(SHOW_DISPOSITIONS_KEY) === 'true'
  } catch {
    return false
  }
}

export function setShowDispositions(show: boolean): void {
  localStorage.setItem(SHOW_DISPOSITIONS_KEY, String(show))
}
