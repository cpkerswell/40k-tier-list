import { useEffect, useRef, useState } from 'react'
import type { MatchupSelection } from '../lib/pairing'
import { pickNextMatchup } from '../lib/pairing'
import { assignTiers } from '../lib/tiers'
import { supabase } from '../lib/supabaseClient'
import {
  getLastOutcomeForFaction,
  recordDrawOutcome,
  recordVotedPair,
  recordWinOutcome,
} from '../lib/voteHistory'
import type { Faction, Tier } from '../types'
import { FactionCard } from './FactionCard'

interface VoteViewProps {
  factions: Faction[]
  loading: boolean
  error: string | null
  knownFactionIds: Set<string>
  voterName: string | null
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

export function VoteView({
  factions,
  loading,
  error,
  knownFactionIds,
  voterName,
  onVoted,
}: VoteViewProps) {
  const [championId, setChampionId] = useState<string | null>(null)
  const [selection, setSelection] = useState<MatchupSelection | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [voteError, setVoteError] = useState<string | null>(null)
  const [impact, setImpact] = useState<VoteImpact | null>(null)
  const pendingImpactRef = useRef<PendingImpact | null>(null)

  useEffect(() => {
    if (factions.length >= 2) {
      setSelection(pickNextMatchup(factions, knownFactionIds, championId))
    }
  }, [factions, knownFactionIds, championId])

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
    if (submitting || !selection) return
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
      p_voter_name: voterName,
    })

    if (rpcError) {
      pendingImpactRef.current = null
      setVoteError(rpcError.message)
      setSubmitting(false)
      return
    }

    recordVotedPair(winner.id, loser.id)
    recordWinOutcome(winner, loser)

    if (!selection.isBothKnown) {
      setChampionId(winner.id)
    }

    await onVoted()
    setSubmitting(false)
  }

  function handleDraw() {
    if (submitting || !selection) return

    const [factionA, factionB] = selection.matchup
    recordVotedPair(factionA.id, factionB.id)
    recordDrawOutcome(factionA, factionB)
    // championId is intentionally left untouched: a draw carries the
    // reigning champion forward instead of resetting the streak.
    setSelection(pickNextMatchup(factions, knownFactionIds, championId))
  }

  if (loading) {
    return <p className="status-message">Summoning the factions...</p>
  }

  if (error) {
    return <p className="status-message status-message--error">{error}</p>
  }

  if (!selection) {
    return (
      <p className="status-message">
        You&rsquo;ve voted on every nearby match-up. Check back once more votes come in and the
        rankings shift.
      </p>
    )
  }

  const [factionA, factionB] = selection.matchup

  return (
    <div className="vote-view">
      <p className="vote-prompt">Who wins?</p>
      <div className="matchup">
        <FactionCard
          faction={factionA}
          disabled={submitting}
          lastOutcome={getLastOutcomeForFaction(factionA.id)}
          onSelect={() => handleVote(factionA, factionB)}
        />
        <span className="matchup__vs">VS</span>
        <FactionCard
          faction={factionB}
          disabled={submitting}
          lastOutcome={getLastOutcomeForFaction(factionB.id)}
          onSelect={() => handleVote(factionB, factionA)}
        />
      </div>
      <button type="button" className="draw-bar" disabled={submitting} onClick={handleDraw}>
        Draw / not sure
      </button>
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
