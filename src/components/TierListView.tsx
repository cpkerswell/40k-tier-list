import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import { useDispositionRatings } from '../hooks/useDispositionRatings'
import { getFactionTheme } from '../lib/factionTheme'
import { assignTiers, TIER_ORDER } from '../lib/tiers'
import type { Faction, Tier } from '../types'
import { FactionIcon } from './icons'

interface TierChipAccentStyle extends CSSProperties {
  '--accent': string
}

interface TierListViewProps {
  groupSlug: string
  isGlobal: boolean
  factions: Faction[]
  loading: boolean
  error: string | null
}

const TIER_LABELS: Record<Tier, string> = {
  S: 'S Tier',
  A: 'A Tier',
  B: 'B Tier',
  C: 'C Tier',
  D: 'D Tier',
}

type ViewMode = 'aggregate' | 'byDisposition'

interface TierEntry {
  id: string
  label: string
  disposition: string | null
  elo_rating: number
  faction: Faction
}

export function TierListView({ groupSlug, isGlobal, factions, loading, error }: TierListViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('aggregate')
  const { dispositionRatings } = useDispositionRatings(groupSlug, isGlobal)

  const entries = useMemo((): TierEntry[] => {
    if (viewMode === 'aggregate') {
      return factions.map((faction) => ({
        id: faction.id,
        label: faction.name,
        disposition: null,
        elo_rating: faction.elo_rating,
        faction,
      }))
    }

    const rowsByFaction = new Map<string, typeof dispositionRatings>()
    dispositionRatings.forEach((row) => {
      const rows = rowsByFaction.get(row.faction_id) ?? []
      rows.push(row)
      rowsByFaction.set(row.faction_id, rows)
    })

    const result: TierEntry[] = []
    factions.forEach((faction) => {
      const rows = rowsByFaction.get(faction.id) ?? []
      if (rows.length >= 2) {
        // Multiple distinct dispositions actually in use for this faction —
        // split it into one ranked row per disposition.
        rows.forEach((row) => {
          result.push({
            id: `${faction.id}::${row.disposition}`,
            label: `${faction.name} — ${row.disposition}`,
            disposition: row.disposition,
            elo_rating: row.elo_rating,
            faction,
          })
        })
      } else {
        // Zero or one disposition in use — stays a single unified row.
        result.push({
          id: faction.id,
          label: faction.name,
          disposition: null,
          elo_rating: faction.elo_rating,
          faction,
        })
      }
    })
    return result
  }, [viewMode, factions, dispositionRatings])

  if (loading) {
    return <p className="status-message">Consulting the Adeptus Administratum...</p>
  }

  if (error) {
    return <p className="status-message status-message--error">{error}</p>
  }

  if (factions.length === 0) {
    return <p className="status-message">No factions yet. Add some in Supabase to get started.</p>
  }

  const sortedEntries = [...entries].sort((a, b) => b.elo_rating - a.elo_rating)
  const tierById = assignTiers(sortedEntries)
  const grouped: Record<Tier, TierEntry[]> = { S: [], A: [], B: [], C: [], D: [] }
  sortedEntries.forEach((entry) => {
    const tier = tierById.get(entry.id) ?? 'D'
    grouped[tier].push(entry)
  })

  return (
    <div className="tier-list-view">
      <div className="tier-view-toggle" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'aggregate'}
          className={`tier-view-toggle__button ${viewMode === 'aggregate' ? 'tier-view-toggle__button--active' : ''}`}
          onClick={() => setViewMode('aggregate')}
        >
          Aggregate
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'byDisposition'}
          className={`tier-view-toggle__button ${viewMode === 'byDisposition' ? 'tier-view-toggle__button--active' : ''}`}
          onClick={() => setViewMode('byDisposition')}
        >
          By Disposition
        </button>
      </div>

      <div className="tier-list">
        {TIER_ORDER.map((tier) => (
          <div key={tier} className={`tier-row tier-row--${tier}`}>
            <div className="tier-row__label">{TIER_LABELS[tier]}</div>
            <div className="tier-row__factions">
              {grouped[tier].map((entry) => {
                const theme = getFactionTheme(entry.faction)
                const style: TierChipAccentStyle = { '--accent': theme.color }
                return (
                  <span key={entry.id} className="tier-chip" style={style}>
                    <FactionIcon icon={theme.icon} className="tier-chip__icon" />
                    {entry.label}
                  </span>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
