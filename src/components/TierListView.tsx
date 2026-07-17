import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import { useDispositionRatings, type DispositionRating } from '../hooks/useDispositionRatings'
import { getFactionTheme } from '../lib/factionTheme'
import { assignTiers, TIER_ORDER } from '../lib/tiers'
import { withViewTransition } from '../lib/viewTransition'
import type { Faction, Tier } from '../types'
import { FactionIcon } from './icons'

interface TierChipAccentStyle extends CSSProperties {
  '--accent': string
  viewTransitionName?: string
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
  faction: Faction
  dispositionLabel: string | null
  elo_rating: number
}

// A disposition needs at least this many votes to influence placement or to
// count toward a "split", so a single stray vote can't reshape the grid.
const MIN_GAMES = 3
// Dispositions must differ by at least this much Elo to be shown as a genuine
// split rather than collapsed to a single front-runner row.
const SPLIT_ELO_GAP = 75

/** Turns a chip id into a valid CSS custom-ident for view-transition-name. */
function transitionName(id: string): string {
  return `vt-${id.replace(/[^a-zA-Z0-9]/g, '_')}`
}

/**
 * Builds the "By Disposition" rows. Per faction:
 *  - No disposition data -> one plain row at its whole-faction rating.
 *  - A clear split (>=2 dispositions with enough votes AND a real Elo gap
 *    between them) -> one row per disposition, each placed by its own rating.
 *  - Otherwise -> a single row placed by its front-runner (best-rated)
 *    disposition and annotated with it, so you see the faction at the
 *    playstyle people rate highest instead of a near-duplicate of Aggregate.
 */
function buildDispositionEntries(
  factions: Faction[],
  dispositionRatings: DispositionRating[],
): TierEntry[] {
  const byFaction = new Map<string, DispositionRating[]>()
  dispositionRatings.forEach((row) => {
    const rows = byFaction.get(row.faction_id) ?? []
    rows.push(row)
    byFaction.set(row.faction_id, rows)
  })

  const entries: TierEntry[] = []
  factions.forEach((faction) => {
    const rows = [...(byFaction.get(faction.id) ?? [])].sort((a, b) => b.elo_rating - a.elo_rating)

    if (rows.length === 0) {
      entries.push({ id: faction.id, faction, dispositionLabel: null, elo_rating: faction.elo_rating })
      return
    }

    const significant = rows.filter((r) => r.games_played >= MIN_GAMES)
    const gap = significant.length
      ? significant[0].elo_rating - significant[significant.length - 1].elo_rating
      : 0

    if (significant.length >= 2 && gap >= SPLIT_ELO_GAP) {
      significant.forEach((row) => {
        entries.push({
          id: `${faction.id}::${row.disposition}`,
          faction,
          dispositionLabel: row.disposition,
          elo_rating: row.elo_rating,
        })
      })
      return
    }

    // Front-runner: prefer the best-rated disposition with enough votes;
    // place there. If none is well-sampled yet, keep the faction at its
    // overall rating but still annotate the leading disposition.
    const runner = significant[0] ?? rows[0]
    entries.push({
      id: faction.id,
      faction,
      dispositionLabel: runner.disposition,
      elo_rating: significant.length ? runner.elo_rating : faction.elo_rating,
    })
  })

  return entries
}

export function TierListView({ groupSlug, isGlobal, factions, loading, error }: TierListViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('aggregate')
  const { dispositionRatings } = useDispositionRatings(groupSlug, isGlobal)

  function switchView(next: ViewMode) {
    if (next === viewMode) return
    withViewTransition(() => setViewMode(next))
  }

  const entries = useMemo((): TierEntry[] => {
    if (viewMode === 'aggregate') {
      return factions.map((faction) => ({
        id: faction.id,
        faction,
        dispositionLabel: null,
        elo_rating: faction.elo_rating,
      }))
    }
    return buildDispositionEntries(factions, dispositionRatings)
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
          onClick={() => switchView('aggregate')}
        >
          Aggregate
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'byDisposition'}
          className={`tier-view-toggle__button ${viewMode === 'byDisposition' ? 'tier-view-toggle__button--active' : ''}`}
          onClick={() => switchView('byDisposition')}
        >
          By Disposition
        </button>
      </div>

      {viewMode === 'byDisposition' && (
        <p className="tier-view-hint">
          Factions show their strongest Force Disposition; ones that clearly play differently
          across dispositions split into separate entries.
        </p>
      )}

      <div className="tier-list">
        {TIER_ORDER.map((tier) => (
          <div key={tier} className={`tier-row tier-row--${tier}`}>
            <div className="tier-row__label">{TIER_LABELS[tier]}</div>
            <div className="tier-row__factions">
              {grouped[tier].map((entry) => {
                const theme = getFactionTheme(entry.faction)
                const style: TierChipAccentStyle = {
                  '--accent': theme.color,
                  viewTransitionName: transitionName(entry.id),
                }
                return (
                  <span key={entry.id} className="tier-chip" style={style}>
                    <FactionIcon icon={theme.icon} className="tier-chip__icon" />
                    <span className="tier-chip__name">{entry.faction.name}</span>
                    {entry.dispositionLabel && (
                      <span className="tier-chip__dispo">{entry.dispositionLabel}</span>
                    )}
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
