import { useEffect, useState } from 'react'
import type { HeadToHeadVote } from '../lib/matrix'
import { supabase } from '../lib/supabaseClient'

interface UseMatchupVotesResult {
  votes: HeadToHeadVote[]
  loading: boolean
  error: string | null
}

/**
 * Fetches every recorded vote involving at least one of `rowFactionIds` — the
 * raw material for the matrix, where rows are the picked factions and columns
 * are every faction in the pool. Needs at least one faction selected;
 * refetches whenever the selection or scope changes.
 */
export function useMatchupVotes(
  groupSlug: string,
  isGlobal: boolean,
  rowFactionIds: string[],
): UseMatchupVotesResult {
  const [votes, setVotes] = useState<HeadToHeadVote[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const idsKey = [...rowFactionIds].sort().join(',')

  useEffect(() => {
    if (rowFactionIds.length === 0) {
      setVotes([])
      setError(null)
      return
    }

    let active = true
    setLoading(true)

    async function load() {
      const idList = rowFactionIds.join(',')
      let query = supabase
        .from('votes')
        .select('winner_id, loser_id')
        .or(`winner_id.in.(${idList}),loser_id.in.(${idList})`)

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
    // rowFactionIds is represented by idsKey to avoid refetching on every
    // re-render when the caller passes a fresh array with the same contents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupSlug, isGlobal, idsKey])

  return { votes, loading, error }
}
