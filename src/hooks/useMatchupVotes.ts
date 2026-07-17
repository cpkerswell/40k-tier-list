import { useEffect, useState } from 'react'
import type { HeadToHeadVote } from '../lib/matrix'
import { supabase } from '../lib/supabaseClient'

interface UseMatchupVotesResult {
  votes: HeadToHeadVote[]
  loading: boolean
  error: string | null
}

/**
 * Fetches every recorded vote where BOTH sides are within `factionIds` — the
 * raw material for the head-to-head matrix. Needs at least two factions
 * selected; refetches whenever the selection or scope changes.
 */
export function useMatchupVotes(
  groupSlug: string,
  isGlobal: boolean,
  factionIds: string[],
): UseMatchupVotesResult {
  const [votes, setVotes] = useState<HeadToHeadVote[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const idsKey = [...factionIds].sort().join(',')

  useEffect(() => {
    if (factionIds.length < 2) {
      setVotes([])
      setError(null)
      return
    }

    let active = true
    setLoading(true)

    async function load() {
      let query = supabase
        .from('votes')
        .select('winner_id, loser_id')
        .in('winner_id', factionIds)
        .in('loser_id', factionIds)

      if (!isGlobal) query = query.eq('group_slug', groupSlug)

      const { data, error: fetchError } = await query

      if (!active) return
      if (fetchError) {
        setError(fetchError.message)
      } else {
        setError(null)
        setVotes(data ?? [])
      }
      setLoading(false)
    }

    load()

    return () => {
      active = false
    }
    // factionIds is represented by idsKey to avoid refetching on every
    // re-render when the caller passes a fresh array with the same contents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupSlug, isGlobal, idsKey])

  return { votes, loading, error }
}
