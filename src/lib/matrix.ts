export interface HeadToHeadVote {
  winner_id: string
  loser_id: string
}

export interface MatrixCell {
  /** Row faction's win rate against the column faction, 0..1. */
  winRate: number
  totalVotes: number
  /** True when there's no direct vote between these two and winRate is
   * estimated from their current Elo ratings instead. */
  isProjected: boolean
}

function eloExpectedWinRate(eloA: number, eloB: number): number {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400))
}

/**
 * Win rate of `rowFactionId` over `colFactionId`. Uses actual recorded votes
 * between exactly these two where they exist; otherwise falls back to an
 * Elo-projected expectation so every cell in the matrix stays informative.
 */
export function computeMatrixCell(
  headToHeadVotes: HeadToHeadVote[],
  rowFactionId: string,
  colFactionId: string,
  rowElo: number,
  colElo: number,
): MatrixCell {
  let rowWins = 0
  let colWins = 0

  headToHeadVotes.forEach((vote) => {
    if (vote.winner_id === rowFactionId && vote.loser_id === colFactionId) rowWins += 1
    else if (vote.winner_id === colFactionId && vote.loser_id === rowFactionId) colWins += 1
  })

  const total = rowWins + colWins
  if (total === 0) {
    return { winRate: eloExpectedWinRate(rowElo, colElo), totalVotes: 0, isProjected: true }
  }
  return { winRate: rowWins / total, totalVotes: total, isProjected: false }
}

/** Red (losing) -> amber -> green (winning), tuned for a dark background. */
export function winRateColor(winRate: number): string {
  const clamped = Math.min(1, Math.max(0, winRate))
  const hue = Math.round(clamped * 120)
  return `hsl(${hue}, 58%, 32%)`
}
