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

const OUTCOMES_KEY = '40k-tier-list:last-outcomes'

export interface FactionOutcome {
  opponentName: string
  result: 'won' | 'lost' | 'draw'
}

interface FactionRef {
  id: string
  name: string
}

function readOutcomes(): Record<string, FactionOutcome> {
  try {
    const raw = localStorage.getItem(OUTCOMES_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, FactionOutcome>) : {}
  } catch {
    return {}
  }
}

function writeOutcomes(outcomes: Record<string, FactionOutcome>): void {
  localStorage.setItem(OUTCOMES_KEY, JSON.stringify(outcomes))
}

export function recordWinOutcome(winner: FactionRef, loser: FactionRef): void {
  const outcomes = readOutcomes()
  outcomes[winner.id] = { opponentName: loser.name, result: 'won' }
  outcomes[loser.id] = { opponentName: winner.name, result: 'lost' }
  writeOutcomes(outcomes)
}

export function recordDrawOutcome(factionA: FactionRef, factionB: FactionRef): void {
  const outcomes = readOutcomes()
  outcomes[factionA.id] = { opponentName: factionB.name, result: 'draw' }
  outcomes[factionB.id] = { opponentName: factionA.name, result: 'draw' }
  writeOutcomes(outcomes)
}

export function getLastOutcomeForFaction(factionId: string): FactionOutcome | null {
  return readOutcomes()[factionId] ?? null
}
