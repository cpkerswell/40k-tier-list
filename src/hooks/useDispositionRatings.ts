import { useEffect, useState } from 'react'
import { isDisposition, type Disposition } from '../lib/dispositions'
import { supabase } from '../lib/supabaseClient'

export interface DispositionRating {
  faction_id: string
  disposition: Disposition
  elo_rating: number
  games_played: number
}

interface UseDispositionRatingsResult {
  dispositionRatings: DispositionRating[]
  loading: boolean
  error: string | null
}

export function useDispositionRatings(
  groupSlug: string,
  isGlobal: boolean,
): UseDispositionRatingsResult {
  const [dispositionRatings, setDispositionRatings] = useState<DispositionRating[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)

    async function load() {
      // Global (root) page aggregates disposition ratings across all groups.
      const { data, error: fetchError } = isGlobal
        ? await supabase.rpc('disposition_ratings_aggregate')
        : await supabase.rpc('disposition_ratings_for_group', { p_group_slug: groupSlug })

      if (!active) return
      if (fetchError) {
        setError(fetchError.message)
      } else {
        setError(null)
        const rows = ((data ?? []) as { faction_id: string; disposition: string; elo_rating: number; games_played: number }[]).filter(
          (row): row is DispositionRating => isDisposition(row.disposition),
        )
        setDispositionRatings(rows)
      }
      setLoading(false)
    }

    load()

    return () => {
      active = false
    }
  }, [groupSlug, isGlobal])

  return { dispositionRatings, loading, error }
}
