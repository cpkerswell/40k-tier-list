function storageKey(groupSlug: string): string {
  return `40k-tier-list:${groupSlug}:matrix-factions`
}

function readMatrixFactionIds(groupSlug: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(groupSlug))
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as string[]) : []
  } catch {
    return []
  }
}

function writeMatrixFactionIds(groupSlug: string, ids: string[]): void {
  localStorage.setItem(storageKey(groupSlug), JSON.stringify(ids))
}

export function getMatrixFactionIds(groupSlug: string): string[] {
  return readMatrixFactionIds(groupSlug)
}

export function toggleMatrixFaction(groupSlug: string, factionId: string): string[] {
  const ids = readMatrixFactionIds(groupSlug)
  const next = ids.includes(factionId) ? ids.filter((id) => id !== factionId) : [...ids, factionId]
  writeMatrixFactionIds(groupSlug, next)
  return next
}
