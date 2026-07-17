import { useLeaderboard } from '../hooks/useLeaderboard'
import { getVoterName } from '../lib/identity'

interface LeaderboardProps {
  groupSlug: string
  isGlobal: boolean
}

const DISPLAY_LIMIT = 8

export function Leaderboard({ groupSlug, isGlobal }: LeaderboardProps) {
  const { entries, loading, error } = useLeaderboard(groupSlug, isGlobal)
  const you = getVoterName()

  // Quietly does nothing when there's no name-tagged voting yet, rather than
  // taking up space on the vote screen with an empty-state message.
  if (loading || error || entries.length === 0) return null

  return (
    <div className="leaderboard">
      <p className="leaderboard__title">Leaderboard</p>
      <div className="leaderboard__list">
        {entries.slice(0, DISPLAY_LIMIT).map((entry, index) => {
          const rank = index + 1
          const isYou = you !== null && entry.voter_name === you
          return (
            <div
              key={entry.voter_name}
              className={`leaderboard__row ${isYou ? 'leaderboard__row--you' : ''}`}
            >
              <span
                className={`leaderboard__rank ${rank <= 3 ? `leaderboard__rank--${rank}` : ''}`}
              >
                {rank}
              </span>
              <span className="leaderboard__name">{entry.voter_name}</span>
              <span className="leaderboard__count">
                {entry.vote_count} vote{entry.vote_count === 1 ? '' : 's'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
