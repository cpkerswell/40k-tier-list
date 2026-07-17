import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { getFactionTheme } from '../lib/factionTheme'
import { formatRelativeTime } from '../lib/relativeTime'
import { supabase } from '../lib/supabaseClient'
import type { Faction } from '../types'
import { FactionIcon } from './icons'

interface ActivityFeedProps {
  factions: Faction[]
  onNewVote?: () => void
}

interface VoteRecord {
  id: string
  winner_id: string
  loser_id: string
  voter_name: string | null
  created_at: string
}

interface FactionTagAccentStyle extends CSSProperties {
  '--accent': string
}

const FEED_LIMIT = 30

function FactionTag({ faction }: { faction: Faction | undefined }) {
  if (!faction) {
    return <span className="feed-tag">a faction</span>
  }

  const theme = getFactionTheme(faction)
  const style: FactionTagAccentStyle = { '--accent': theme.color }

  return (
    <span className="feed-tag" style={style}>
      <FactionIcon icon={theme.icon} className="feed-tag__icon" />
      {faction.name}
    </span>
  )
}

export function ActivityFeed({ factions, onNewVote }: ActivityFeedProps) {
  const [votes, setVotes] = useState<VoteRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadInitial() {
      const { data, error: fetchError } = await supabase
        .from('votes')
        .select('id, winner_id, loser_id, voter_name, created_at')
        .order('created_at', { ascending: false })
        .limit(FEED_LIMIT)

      if (!active) return
      if (fetchError) {
        setError(fetchError.message)
      } else {
        setVotes(data ?? [])
      }
      setLoading(false)
    }

    loadInitial()

    const channel = supabase
      .channel('votes-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'votes' },
        (payload) => {
          const newVote = payload.new as VoteRecord
          setVotes((previous) => [newVote, ...previous].slice(0, FEED_LIMIT))
          onNewVote?.()
        },
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [onNewVote])

  const factionById = new Map(factions.map((faction) => [faction.id, faction]))

  return (
    <div className="feed">
      <h2 className="feed__heading">Live Activity</h2>
      {loading && <p className="status-message">Loading recent activity...</p>}
      {!loading && error && <p className="status-message status-message--error">{error}</p>}
      {!loading && !error && votes.length === 0 && (
        <p className="status-message">No votes yet. Be the first!</p>
      )}
      {!loading && !error && votes.length > 0 && (
        <div className="feed__list">
          {votes.map((vote) => (
            <div key={vote.id} className="feed-item">
              <p className="feed-item__pick">
                <strong>{vote.voter_name || 'Someone'}</strong> picked{' '}
                <FactionTag faction={factionById.get(vote.winner_id)} /> over{' '}
                <FactionTag faction={factionById.get(vote.loser_id)} />
              </p>
              <span className="feed-item__time">{formatRelativeTime(vote.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
