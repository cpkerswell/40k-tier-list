const STORAGE_KEY = '40k-tier-list:known-factions'

function readKnownFactionIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed: unknown = JSON.parse(raw)
    return new Set(Array.isArray(parsed) ? (parsed as string[]) : [])
  } catch {
    return new Set()
  }
}

function writeKnownFactionIds(factionIds: Set<string>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(factionIds)))
}

export function getKnownFactionIds(): Set<string> {
  return readKnownFactionIds()
}

export function toggleKnownFaction(factionId: string): Set<string> {
  const factionIds = readKnownFactionIds()
  if (factionIds.has(factionId)) {
    factionIds.delete(factionId)
  } else {
    factionIds.add(factionId)
  }
  writeKnownFactionIds(factionIds)
  return factionIds
}
