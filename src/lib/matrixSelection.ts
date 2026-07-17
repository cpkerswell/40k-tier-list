export const MAX_MATRIX_FACTIONS = 8

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

/** No-ops (returns the unchanged list) if trying to add past MAX_MATRIX_FACTIONS. */
export function toggleMatrixFaction(groupSlug: string, factionId: string): string[] {
  const ids = readMatrixFactionIds(groupSlug)
  const isSelected = ids.includes(factionId)

  if (!isSelected && ids.length >= MAX_MATRIX_FACTIONS) {
    return ids
  }

  const next = isSelected ? ids.filter((id) => id !== factionId) : [...ids, factionId]
  writeMatrixFactionIds(groupSlug, next)
  return next
}
