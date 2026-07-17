import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { getFactionTheme } from '../lib/factionTheme'
import { formatRelativeTime } from '../lib/relativeTime'
import { supabase } from '../lib/supabaseClient'
import { assignTiers } from '../lib/tiers'
import type { Faction, Tier } from '../types'
import { FactionIcon } from './icons'
import { TierPill } from './TierPill'

interface ActivityFeedProps {
  groupSlug: string
  factions: Faction[]
  onNewVote?: () => void
}

interface VoteRecord {
  id: string
  winner_id: string
  loser_id: string
  winner_elo_before: number
  loser_elo_before: number
  winner_elo_after: number
  loser_elo_after: number
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

/**
 * Re-tiers the current standings with one or two factions' Elo swapped out
 * for a specific value, everything else held at today's rating. Used to
 * approximate "did this specific vote's rating swing cross a tier boundary,
 * given how things stand now" — we don't store a full ranking snapshot per
 * vote, so this is measured against the current pool rather than history.
 */
function tiersWithOverrides(
  factions: Faction[],
  overrides: Record<string, number>,
): Map<string, Tier> {
  const overridden = factions.map((faction) =>
    faction.id in overrides ? { ...faction, elo_rating: overrides[faction.id] } : faction,
  )
  overridden.sort((a, b) => b.elo_rating - a.elo_rating)
  return assignTiers(overridden)
}

interface TierShift {
  winnerBefore: Tier
  winnerAfter: Tier
  loserBefore: Tier
  loserAfter: Tier
}

function computeTierShift(factions: Faction[], vote: VoteRecord): TierShift | null {
  if (factions.length === 0) return null

  const before = tiersWithOverrides(factions, {
    [vote.winner_id]: vote.winner_elo_before,
    [vote.loser_id]: vote.loser_elo_before,
  })
  const after = tiersWithOverrides(factions, {
    [vote.winner_id]: vote.winner_elo_after,
    [vote.loser_id]: vote.loser_elo_after,
  })

  const winnerBefore = before.get(vote.winner_id)
  const winnerAfter = after.get(vote.winner_id)
  const loserBefore = before.get(vote.loser_id)
  const loserAfter = after.get(vote.loser_id)
  if (!winnerBefore || !winnerAfter || !loserBefore || !loserAfter) return null

  if (winnerBefore === winnerAfter && loserBefore === loserAfter) return null

  return { winnerBefore, winnerAfter, loserBefore, loserAfter }
}

export function ActivityFeed({ groupSlug, factions, onNewVote }: ActivityFeedProps) {
  const [votes, setVotes] = useState<VoteRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)

    async function loadInitial() {
      const { data, error: fetchError } = await supabase
        .from('votes')
        .select(
          'id, winner_id, loser_id, winner_elo_before, loser_elo_before, winner_elo_after, loser_elo_after, voter_name, created_at',
        )
        .eq('group_slug', groupSlug)
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
      .channel(`votes-feed-${groupSlug}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'votes',
          filter: `group_slug=eq.${groupSlug}`,
        },
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
  }, [groupSlug, onNewVote])

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
          {votes.map((vote) => {
            const winnerFaction = factionById.get(vote.winner_id)
            const loserFaction = factionById.get(vote.loser_id)
            const shift = computeTierShift(factions, vote)

            return (
              <div key={vote.id} className="feed-item">
                <div className="feed-item__header">
                  <p className="feed-item__pick">
                    <strong>{vote.voter_name || 'Someone'}</strong> picked{' '}
                    <FactionTag faction={winnerFaction} /> over <FactionTag faction={loserFaction} />
                  </p>
                  <span className="feed-item__time">{formatRelativeTime(vote.created_at)}</span>
                </div>
                {shift && (
                  <p className="feed-item__tier-shift">
                    {shift.winnerBefore !== shift.winnerAfter && winnerFaction && (
                      <span className="feed-item__shift-entry">
                        {winnerFaction.name} <TierPill tier={shift.winnerBefore} />
                        <span aria-hidden="true">&rarr;</span>
                        <TierPill tier={shift.winnerAfter} />
                      </span>
                    )}
                    {shift.loserBefore !== shift.loserAfter && loserFaction && (
                      <span className="feed-item__shift-entry">
                        {loserFaction.name} <TierPill tier={shift.loserBefore} />
                        <span aria-hidden="true">&rarr;</span>
                        <TierPill tier={shift.loserAfter} />
                      </span>
                    )}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
