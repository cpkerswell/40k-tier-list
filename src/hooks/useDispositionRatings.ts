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

export function useDispositionRatings(groupSlug: string): UseDispositionRatingsResult {
  const [dispositionRatings, setDispositionRatings] = useState<DispositionRating[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)

    async function load() {
      const { data, error: fetchError } = await supabase.rpc('disposition_ratings_for_group', {
        p_group_slug: groupSlug,
      })

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
  }, [groupSlug])

  return { dispositionRatings, loading, error }
}
