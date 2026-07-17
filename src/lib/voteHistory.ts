const STORAGE_KEY = '40k-tier-list:voted-pairs'

function pairKey(factionIdA: string, factionIdB: string): string {
  return [factionIdA, factionIdB].sort().join('|')
}

function readVotedPairs(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed: unknown = JSON.parse(raw)
    return new Set(Array.isArray(parsed) ? (parsed as string[]) : [])
  } catch {
    return new Set()
  }
}

export function hasVotedOnPair(factionIdA: string, factionIdB: string): boolean {
  return readVotedPairs().has(pairKey(factionIdA, factionIdB))
}

export function recordVotedPair(factionIdA: string, factionIdB: string): void {
  const votedPairs = readVotedPairs()
  votedPairs.add(pairKey(factionIdA, factionIdB))
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(votedPairs)))
}
