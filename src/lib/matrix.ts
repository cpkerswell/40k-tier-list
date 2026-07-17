export interface HeadToHeadVote {
  winner_id: string
  loser_id: string
  winner_disposition: string | null
  loser_disposition: string | null
}

export interface MatrixCell {
  /** Subject faction's win rate against the opponent, 0..1. */
  winRate: number
  totalVotes: number
  /** True when there's no direct vote between these two (matching any
   * disposition filter) and winRate is estimated from Elo instead. */
  isProjected: boolean
}

function eloExpectedWinRate(eloA: number, eloB: number): number {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400))
}

/**
 * Win rate of `subjectFactionId` over `opponentFactionId`. Uses actual
 * recorded votes between exactly these two where they exist; otherwise falls
 * back to an Elo-projected expectation so every cell stays informative.
 *
 * When `subjectDisposition` is given, only votes where the subject's side was
 * tagged with that exact disposition count toward the actual record (the
 * opponent's disposition, if any, is irrelevant here — the subject is what's
 * being measured). Pair this with the subject's disposition-specific Elo
 * (rather than its whole-faction Elo) for the projected fallback too.
 */
export function computeMatrixCell(
  headToHeadVotes: HeadToHeadVote[],
  subjectFactionId: string,
  opponentFactionId: string,
  subjectElo: number,
  opponentElo: number,
  subjectDisposition?: string | null,
): MatrixCell {
  let subjectWins = 0
  let opponentWins = 0

  headToHeadVotes.forEach((vote) => {
    if (subjectDisposition) {
      const subjectWasWinner = vote.winner_id === subjectFactionId
      const subjectWasLoser = vote.loser_id === subjectFactionId
      if (subjectWasWinner && vote.winner_disposition !== subjectDisposition) return
      if (subjectWasLoser && vote.loser_disposition !== subjectDisposition) return
    }

    if (vote.winner_id === subjectFactionId && vote.loser_id === opponentFactionId) {
      subjectWins += 1
    } else if (vote.winner_id === opponentFactionId && vote.loser_id === subjectFactionId) {
      opponentWins += 1
    }
  })

  const total = subjectWins + opponentWins
  if (total === 0) {
    return { winRate: eloExpectedWinRate(subjectElo, opponentElo), totalVotes: 0, isProjected: true }
  }
  return { winRate: subjectWins / total, totalVotes: total, isProjected: false }
}

/** Red (losing) -> amber -> green (winning), tuned for a dark background. */
export function winRateColor(winRate: number): string {
  const clamped = Math.min(1, Math.max(0, winRate))
  const hue = Math.round(clamped * 120)
  return `hsl(${hue}, 58%, 32%)`
}
