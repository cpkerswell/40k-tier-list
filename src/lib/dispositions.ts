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

const SHOW_DISPOSITIONS_KEY = '40k-tier-list:show-dispositions'

/** Global (not per-group) — this is about how you like to see the app. */
export function getShowDispositions(): boolean {
  try {
    const raw = localStorage.getItem(SHOW_DISPOSITIONS_KEY)
    return raw === null ? true : raw === 'true'
  } catch {
    return true
  }
}

export function setShowDispositions(show: boolean): void {
  localStorage.setItem(SHOW_DISPOSITIONS_KEY, String(show))
}
