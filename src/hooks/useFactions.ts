import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
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

  const refetch = useCallback(async () => {
    setLoading(true)
    // Global (root) page shows a combined ranking across all groups; a named
    // group shows only its own ratings.
    const { data, error: fetchError } = isGlobal
      ? await supabase.rpc('factions_aggregate')
      : await supabase.rpc('factions_for_group', { p_group_slug: groupSlug })

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setError(null)
      setFactions(data ?? [])
    }
    setLoading(false)
  }, [groupSlug, isGlobal])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { factions, loading, error, refetch }
}
