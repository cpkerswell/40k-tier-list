import { useEffect, useMemo, useRef, useState } from 'react'
import { getDispositionsForFaction, pickRandomDisposition, type Disposition } from '../lib/dispositions'
import type { MatchupSelection } from '../lib/pairing'
import { pickNextMatchup, pickRandomMatchup } from '../lib/pairing'
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
import { Leaderboard } from './Leaderboard'
import { TierPill } from './TierPill'

interface VoteViewProps {
  groupSlug: string
  isGlobal: boolean
  factions: Faction[]
  loading: boolean
  error: string | null
  knownFactionIds: Set<string>
  voterName: string
  showDispositions: boolean
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

export function VoteView({
  groupSlug,
  isGlobal,
  factions,
  loading,
  error,
  knownFactionIds,
  voterName,
  showDispositions,
  onVoted,
}: VoteViewProps) {
  const [championId, setChampionId] = useState<string | null>(null)
  const [championSlot, setChampionSlot] = useState<0 | 1>(0)
  const [selection, setSelection] = useState<MatchupSelection | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [voteError, setVoteError] = useState<string | null>(null)
  const [impact, setImpact] = useState<VoteImpact | null>(null)
  const pendingImpactRef = useRef<PendingImpact | null>(null)

  // Deliberately doesn't depend on championId/championSlot: those are only
  // ever set alongside a factions/knownFactionIds change (a real vote) or
  // handled with an explicit setSelection of their own (draw, shuffle).
  // Watching them here too would re-run this right after e.g. shuffle resets
  // championId, clobbering the manual pick with a fresh priority-based one.
  useEffect(() => {
    if (factions.length >= 2) {
      setSelection(pickNextMatchup(groupSlug, factions, knownFactionIds, championId, championSlot))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupSlug, factions, knownFactionIds])

  // Picked once per match-up (not per render), so what's displayed on each
  // card is exactly what gets submitted alongside the vote.
  const matchupDispositions = useMemo((): [Disposition | null, Disposition | null] => {
    if (!selection || !showDispositions) return [null, null]
    const [factionA, factionB] = selection.matchup
    return [
      pickRandomDisposition(getDispositionsForFaction(groupSlug, factionA.id)),
      pickRandomDisposition(getDispositionsForFaction(groupSlug, factionB.id)),
    ]
  }, [selection, groupSlug, showDispositions])

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

    const winnerSlot = selection.matchup[0].id === winner.id ? 0 : 1
    const winnerDisposition = matchupDispositions[winnerSlot]
    const loserDisposition = matchupDispositions[winnerSlot === 0 ? 1 : 0]

    const { error: rpcError } = await supabase.rpc('record_vote', {
      p_winner_id: winner.id,
      p_loser_id: loser.id,
      p_voter_name: voterName,
      p_group_slug: groupSlug,
      p_winner_disposition: winnerDisposition,
      p_loser_disposition: loserDisposition,
    })

    if (rpcError) {
      pendingImpactRef.current = null
      setVoteError(rpcError.message)
      setSubmitting(false)
      return
    }

    recordVotedPair(groupSlug, winner.id, loser.id)
    recordWinOutcome(groupSlug, winner, loser)

    if (!selection.isBothKnown) {
      setChampionId(winner.id)
      setChampionSlot(winnerSlot)
    }

    await onVoted()
    setSubmitting(false)
  }

  function handleDraw() {
    if (submitting || !selection) return

    const [factionA, factionB] = selection.matchup
    recordVotedPair(groupSlug, factionA.id, factionB.id)
    recordDrawOutcome(groupSlug, factionA, factionB)
    // championId/championSlot are intentionally left untouched: a draw
    // carries the reigning champion forward, in the same slot, instead of
    // resetting the streak.
    setSelection(pickNextMatchup(groupSlug, factions, knownFactionIds, championId, championSlot))
  }

  function handleShuffle() {
    if (submitting) return
    // Doesn't record anything — drops the current champion streak (if any)
    // and ignores known-faction priority entirely, so it actually breaks
    // away from a faction the phase order keeps resurfacing.
    setChampionId(null)
    const randomPair = pickRandomMatchup(groupSlug, factions)
    setSelection(randomPair ? { matchup: randomPair, isBothKnown: true } : null)
  }

  if (loading) {
    return <p className="status-message">Summoning the factions...</p>
  }

  if (error) {
    return <p className="status-message status-message--error">{error}</p>
  }

  if (!selection) {
    return (
      <div className="vote-view">
        <p className="status-message">
          You&rsquo;ve voted on every nearby match-up. Check back once more votes come in and the
          rankings shift.
        </p>
        <Leaderboard groupSlug={groupSlug} isGlobal={isGlobal} />
      </div>
    )
  }

  const [factionA, factionB] = selection.matchup
  const [dispositionA, dispositionB] = matchupDispositions

  return (
    <div className="vote-view">
      <p className="vote-prompt">Who wins?</p>
      <div className="matchup">
        <FactionCard
          faction={factionA}
          disabled={submitting}
          lastOutcome={getLastOutcomeForFaction(groupSlug, factionA.id)}
          disposition={dispositionA}
          onSelect={() => handleVote(factionA, factionB)}
        />
        <span className="matchup__vs">VS</span>
        <FactionCard
          faction={factionB}
          disabled={submitting}
          lastOutcome={getLastOutcomeForFaction(groupSlug, factionB.id)}
          disposition={dispositionB}
          onSelect={() => handleVote(factionB, factionA)}
        />
      </div>
      <div className="secondary-actions">
        <button type="button" className="draw-bar" disabled={submitting} onClick={handleDraw}>
          Draw / not sure
        </button>
        <button type="button" className="shuffle-bar" disabled={submitting} onClick={handleShuffle}>
          Show me something else
        </button>
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
      <Leaderboard groupSlug={groupSlug} isGlobal={isGlobal} />
    </div>
  )
}
