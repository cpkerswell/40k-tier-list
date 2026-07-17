function storageKey(groupSlug: string): string {
  return `40k-tier-list:${groupSlug}:known-factions`
}

function readKnownFactionIds(groupSlug: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(groupSlug))
    if (!raw) return new Set()
    const parsed: unknown = JSON.parse(raw)
    return new Set(Array.isArray(parsed) ? (parsed as string[]) : [])
  } catch {
    return new Set()
  }
}

function writeKnownFactionIds(groupSlug: string, factionIds: Set<string>): void {
  localStorage.setItem(storageKey(groupSlug), JSON.stringify(Array.from(factionIds)))
}

export function getKnownFactionIds(groupSlug: string): Set<string> {
  return readKnownFactionIds(groupSlug)
}

export function toggleKnownFaction(groupSlug: string, factionId: string): Set<string> {
  const factionIds = readKnownFactionIds(groupSlug)
  if (factionIds.has(factionId)) {
    factionIds.delete(factionId)
  } else {
    factionIds.add(factionId)
  }
  writeKnownFactionIds(groupSlug, factionIds)
  return factionIds
}
