import { useEffect, useRef, useState } from 'react'
import { assignTiers } from '../lib/tiers'
import { pickMatchup } from '../lib/pairing'
import { supabase } from '../lib/supabaseClient'
import { recordVotedPair } from '../lib/voteHistory'
import type { Faction, Tier } from '../types'
import { FactionCard } from './FactionCard'

interface VoteViewProps {
  factions: Faction[]
  loading: boolean
  error: string | null
  knownFactionIds: Set<string>
  onVoted: () => Promise<void>
}

interface VoteImpact {
  winner: { name: string; before: Tier; after: Tier }
  loser: { name: string; before: Tier; after: Tier }
}

interface PendingImpact {
  winnerId: string
  winnerName: string
  winnerTierBefore: Tier
  loserId: string
  loserName: string
  loserTierBefore: Tier
}

function TierPill({ tier }: { tier: Tier }) {
  return <span className={`tier-pill tier-pill--${tier}`}>{tier}</span>
}

export function VoteView({ factions, loading, error, knownFactionIds, onVoted }: VoteViewProps) {
  const [matchup, setMatchup] = useState<[Faction, Faction] | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [voteError, setVoteError] = useState<string | null>(null)
  const [impact, setImpact] = useState<VoteImpact | null>(null)
  const pendingImpactRef = useRef<PendingImpact | null>(null)

  useEffect(() => {
    if (factions.length >= 2) {
      setMatchup(pickMatchup(factions, knownFactionIds))
    }
  }, [factions, knownFactionIds])

  // Fires once `factions` has been refetched after a vote, so we can compare
  // tier placement before vs. after using the freshly recalculated Elo order.
  useEffect(() => {
    const pending = pendingImpactRef.current
    if (!pending || factions.length === 0) return

    const tierByFactionId = assignTiers(factions)
    setImpact({
      winner: {
        name: pending.winnerName,
        before: pending.winnerTierBefore,
        after: tierByFactionId.get(pending.winnerId) ?? pending.winnerTierBefore,
      },
      loser: {
        name: pending.loserName,
        before: pending.loserTierBefore,
        after: tierByFactionId.get(pending.loserId) ?? pending.loserTierBefore,
      },
    })
    pendingImpactRef.current = null
  }, [factions])

  async function handleVote(winner: Faction, loser: Faction) {
    if (submitting) return
    setSubmitting(true)
    setVoteError(null)

    const tierByFactionId = assignTiers(factions)
    pendingImpactRef.current = {
      winnerId: winner.id,
      winnerName: winner.name,
      winnerTierBefore: tierByFactionId.get(winner.id) ?? 'D',
      loserId: loser.id,
      loserName: loser.name,
      loserTierBefore: tierByFactionId.get(loser.id) ?? 'D',
    }

    const { error: rpcError } = await supabase.rpc('record_vote', {
      p_winner_id: winner.id,
      p_loser_id: loser.id,
    })

    if (rpcError) {
      pendingImpactRef.current = null
      setVoteError(rpcError.message)
      setSubmitting(false)
      return
    }

    recordVotedPair(winner.id, loser.id)
    await onVoted()
    setSubmitting(false)
  }

  if (loading) {
    return <p className="status-message">Summoning the factions...</p>
  }

  if (error) {
    return <p className="status-message status-message--error">{error}</p>
  }

  if (!matchup) {
    return (
      <p className="status-message">
        You&rsquo;ve voted on every nearby match-up. Check back once more votes come in and the
        rankings shift.
      </p>
    )
  }

  const [factionA, factionB] = matchup

  return (
    <div className="vote-view">
      <p className="vote-prompt">Who wins?</p>
      <div className="matchup">
        <FactionCard
          faction={factionA}
          disabled={submitting}
          onSelect={() => handleVote(factionA, factionB)}
        />
        <span className="matchup__vs">VS</span>
        <FactionCard
          faction={factionB}
          disabled={submitting}
          onSelect={() => handleVote(factionB, factionA)}
        />
      </div>
      {voteError && <p className="status-message status-message--error">{voteError}</p>}
      {impact && (
        <div className="impact">
          <p className="impact__title">Impact of your last vote</p>
          <div className="impact__row">
            <span className="impact__name">{impact.winner.name}</span>
            <TierPill tier={impact.winner.before} />
            <span className="impact__arrow" aria-hidden="true">
              &rarr;
            </span>
            <TierPill tier={impact.winner.after} />
          </div>
          <div className="impact__row">
            <span className="impact__name">{impact.loser.name}</span>
            <TierPill tier={impact.loser.before} />
            <span className="impact__arrow" aria-hidden="true">
              &rarr;
            </span>
            <TierPill tier={impact.loser.after} />
          </div>
        </div>
      )}
    </div>
  )
}
