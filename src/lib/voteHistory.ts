function pairsStorageKey(groupSlug: string): string {
  return `40k-tier-list:${groupSlug}:voted-pairs`
}

function pairKey(factionIdA: string, factionIdB: string): string {
  return [factionIdA, factionIdB].sort().join('|')
}

function readVotedPairs(groupSlug: string): Set<string> {
  try {
    const raw = localStorage.getItem(pairsStorageKey(groupSlug))
    if (!raw) return new Set()
    const parsed: unknown = JSON.parse(raw)
    return new Set(Array.isArray(parsed) ? (parsed as string[]) : [])
  } catch {
    return new Set()
  }
}

export function hasVotedOnPair(groupSlug: string, factionIdA: string, factionIdB: string): boolean {
  return readVotedPairs(groupSlug).has(pairKey(factionIdA, factionIdB))
}

export function recordVotedPair(groupSlug: string, factionIdA: string, factionIdB: string): void {
  const votedPairs = readVotedPairs(groupSlug)
  votedPairs.add(pairKey(factionIdA, factionIdB))
  localStorage.setItem(pairsStorageKey(groupSlug), JSON.stringify(Array.from(votedPairs)))
}

function outcomesStorageKey(groupSlug: string): string {
  return `40k-tier-list:${groupSlug}:last-outcomes`
}

export interface FactionOutcome {
  opponentName: string
  result: 'won' | 'lost' | 'draw'
}

interface FactionRef {
  id: string
  name: string
}

function readOutcomes(groupSlug: string): Record<string, FactionOutcome> {
  try {
    const raw = localStorage.getItem(outcomesStorageKey(groupSlug))
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, FactionOutcome>) : {}
  } catch {
    return {}
  }
}

function writeOutcomes(groupSlug: string, outcomes: Record<string, FactionOutcome>): void {
  localStorage.setItem(outcomesStorageKey(groupSlug), JSON.stringify(outcomes))
}

export function recordWinOutcome(groupSlug: string, winner: FactionRef, loser: FactionRef): void {
  const outcomes = readOutcomes(groupSlug)
  outcomes[winner.id] = { opponentName: loser.name, result: 'won' }
  outcomes[loser.id] = { opponentName: winner.name, result: 'lost' }
  writeOutcomes(groupSlug, outcomes)
}

export function recordDrawOutcome(groupSlug: string, factionA: FactionRef, factionB: FactionRef): void {
  const outcomes = readOutcomes(groupSlug)
  outcomes[factionA.id] = { opponentName: factionB.name, result: 'draw' }
  outcomes[factionB.id] = { opponentName: factionA.name, result: 'draw' }
  writeOutcomes(groupSlug, outcomes)
}

export function getLastOutcomeForFaction(groupSlug: string, factionId: string): FactionOutcome | null {
  return readOutcomes(groupSlug)[factionId] ?? null
}
