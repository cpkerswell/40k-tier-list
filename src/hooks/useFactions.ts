import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { withViewTransition } from '../lib/viewTransition'
import type { Faction } from '../types'

interface UseFactionsResult {
  factions: Faction[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useFactions(groupSlug: string, isGlobal: boolean): UseFactionsResult {
  const [factions, setFactions] = useState<Faction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasLoadedRef = useRef(false)

  const refetch = useCallback(async () => {
    // Global (root) page shows a combined ranking across all groups; a named
    // group shows only its own ratings.
    const { data, error: fetchError } = isGlobal
      ? await supabase.rpc('factions_aggregate')
      : await supabase.rpc('factions_for_group', { p_group_slug: groupSlug })

    if (fetchError) {
      setError(fetchError.message)
    } else {
      const apply = () => {
        setError(null)
        setFactions(data ?? [])
      }
      // First load renders plainly; later refetches (e.g. a live vote) animate
      // the ranking change via a View Transition instead of blanking the grid.
      if (hasLoadedRef.current) {
        withViewTransition(apply)
      } else {
        apply()
      }
    }
    hasLoadedRef.current = true
    setLoading(false)
  }, [groupSlug, isGlobal])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { factions, loading, error, refetch }
}
