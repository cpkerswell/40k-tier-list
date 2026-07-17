import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export interface LeaderboardEntry {
  voter_name: string
  vote_count: number
}

interface UseLeaderboardResult {
  entries: LeaderboardEntry[]
  loading: boolean
  error: string | null
}

export function useLeaderboard(groupSlug: string, isGlobal: boolean): UseLeaderboardResult {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function load() {
      const { data, error: fetchError } = isGlobal
        ? await supabase.rpc('leaderboard_aggregate')
        : await supabase.rpc('leaderboard_for_group', { p_group_slug: groupSlug })

      if (!active) return
      if (fetchError) {
        setError(fetchError.message)
      } else {
        setError(null)
        setEntries((data ?? []) as LeaderboardEntry[])
      }
      setLoading(false)
    }

    load()

    // Refresh whenever anyone in scope casts a new vote, so standings stay live.
    const channel = supabase
      .channel(`leaderboard-${isGlobal ? 'global' : groupSlug}`)
      .on(
        'postgres_changes',
        isGlobal
          ? { event: 'INSERT', schema: 'public', table: 'votes' }
          : {
              event: 'INSERT',
              schema: 'public',
              table: 'votes',
              filter: `group_slug=eq.${groupSlug}`,
            },
        () => load(),
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [groupSlug, isGlobal])

  return { entries, loading, error }
}
