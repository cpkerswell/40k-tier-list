import type { CSSProperties } from 'react'
import { useState } from 'react'
import { useDispositionRatings, type DispositionRating } from '../hooks/useDispositionRatings'
import { useMatchupVotes } from '../hooks/useMatchupVotes'
import { findClearDisposition } from '../lib/dispositions'
import { getFactionTheme, readableInk } from '../lib/factionTheme'
import { computeMatrixCell, winRateColor } from '../lib/matrix'
import { getMatrixFactionIds, MAX_MATRIX_FACTIONS, toggleMatrixFaction } from '../lib/matrixSelection'
import type { Faction, FactionType } from '../types'
import { FactionIcon } from './icons'

interface MatchupMatrixProps {
  groupSlug: string
  isGlobal: boolean
  factions: Faction[]
  showDispositions: boolean
}

interface AccentStyle extends CSSProperties {
  '--accent': string
  '--accent-ink': string
}

const TYPE_ORDER: FactionType[] = ['Imperium', 'Chaos', 'Xenos']

export function MatchupMatrix({ groupSlug, isGlobal, factions, showDispositions }: MatchupMatrixProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(() => getMatrixFactionIds(groupSlug))
  const { votes, loading, error } = useMatchupVotes(groupSlug, isGlobal, selectedIds)
  const { dispositionRatings } = useDispositionRatings(groupSlug, isGlobal)
  const atCap = selectedIds.length >= MAX_MATRIX_FACTIONS

  function handleToggle(factionId: string) {
    setSelectedIds(toggleMatrixFaction(groupSlug, factionId))
  }

  // Picked factions run along the top (columns); every other faction runs
  // down the side (rows), so each pick is measured against the whole field.
  const pickedFactions = selectedIds
    .map((id) => factions.find((faction) => faction.id === id))
    .filter((faction): faction is Faction => Boolean(faction))
  const allFactionsByElo = [...factions].sort((a, b) => b.elo_rating - a.elo_rating)

  const ratingsByFaction = new Map<string, DispositionRating[]>()
  dispositionRatings.forEach((rating) => {
    const ratings = ratingsByFaction.get(rating.faction_id) ?? []
    ratings.push(rating)
    ratingsByFaction.set(rating.faction_id, ratings)
  })

  // Only when a picked faction has a genuinely clear front-runner disposition
  // (see findClearDisposition) do we use it: its disposition-scoped Elo for
  // the projected fallback, and its disposition-tagged votes for the actual
  // record, instead of the faction's whole-faction numbers.
  const clearDispositionByFaction = new Map<
    string,
    { disposition: string; elo_rating: number } | null
  >()
  if (showDispositions) {
    pickedFactions.forEach((faction) => {
      clearDispositionByFaction.set(
        faction.id,
        findClearDisposition(ratingsByFaction.get(faction.id) ?? []),
      )
    })
  }

  return (
    <div className="matrix-section">
      <h2 className="matrix-section__title">Matchup Matrix</h2>
      <p className="matrix-section__intro">
        Pick up to {MAX_MATRIX_FACTIONS} factions to see how they stack up against every other
        faction. Green means a strong match-up, red means weak, based on actual votes between
        that pair — or an Elo-projected estimate (dashed border) when they haven't faced off yet.
        {showDispositions &&
          ' When a faction has a clear standout Force Disposition, the matrix uses that instead of its overall rating.'}
      </p>

      {TYPE_ORDER.map((type) => {
        const group = factions.filter((faction) => faction.faction_type === type)
        if (group.length === 0) return null

        return (
          <div key={type} className="matrix-picker-group">
            <h3 className="preferences__group-title">{type}</h3>
            <div className="matrix-picker">
              {group.map((faction) => {
                const theme = getFactionTheme(faction)
                const active = selectedIds.includes(faction.id)
                const disabled = atCap && !active
                const style: AccentStyle = {
                  '--accent': theme.color,
                  '--accent-ink': readableInk(theme.color),
                }
                return (
                  <button
                    key={faction.id}
                    type="button"
                    className={`matrix-chip ${active ? 'matrix-chip--active' : ''}`}
                    style={style}
                    aria-pressed={active}
                    disabled={disabled}
                    onClick={() => handleToggle(faction.id)}
                  >
                    <FactionIcon icon={theme.icon} className="matrix-chip__icon" />
                    {faction.name}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      <p className="matrix-section__count">
        {selectedIds.length} / {MAX_MATRIX_FACTIONS} selected
      </p>

      {pickedFactions.length === 0 && (
        <p className="status-message">Pick at least one faction to see the matrix.</p>
      )}

      {pickedFactions.length > 0 && (
        <>
          {loading && <p className="status-message">Loading matchups...</p>}
          {error && <p className="status-message status-message--error">{error}</p>}
          {!loading && !error && (
            <div className="matrix-scroll">
              <table className="matrix-table">
                <thead>
                  <tr>
                    <th className="matrix-table__corner" />
                    {pickedFactions.map((colFaction) => {
                      const theme = getFactionTheme(colFaction)
                      const style: AccentStyle = {
                        '--accent': theme.color,
                        '--accent-ink': readableInk(theme.color),
                      }
                      const clear = clearDispositionByFaction.get(colFaction.id)
                      return (
                        <th key={colFaction.id} className="matrix-table__header" style={style}>
                          <FactionIcon icon={theme.icon} className="matrix-table__header-icon" />
                          {clear && <span className="matrix-table__header-dispo">{clear.disposition}</span>}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {allFactionsByElo.map((rowFaction) => {
                    const rowTheme = getFactionTheme(rowFaction)
                    const rowStyle: AccentStyle = {
                      '--accent': rowTheme.color,
                      '--accent-ink': readableInk(rowTheme.color),
                    }
                    return (
                      <tr key={rowFaction.id}>
                        <th className="matrix-table__rowhead" style={rowStyle}>
                          <FactionIcon icon={rowTheme.icon} className="matrix-table__header-icon" />
                          <span>{rowFaction.name}</span>
                        </th>
                        {pickedFactions.map((colFaction) => {
                          if (rowFaction.id === colFaction.id) {
                            return (
                              <td key={colFaction.id} className="matrix-cell matrix-cell--self">
                                &mdash;
                              </td>
                            )
                          }

                          // Cell shows the PICKED (column) faction's win rate
                          // over the row faction, since the picks are the
                          // focus of this view -- using its clear disposition
                          // data in place of whole-faction numbers when one
                          // stands out.
                          const clear = clearDispositionByFaction.get(colFaction.id)
                          const cell = computeMatrixCell(
                            votes,
                            colFaction.id,
                            rowFaction.id,
                            clear ? clear.elo_rating : colFaction.elo_rating,
                            rowFaction.elo_rating,
                            clear?.disposition,
                          )
                          const percent = Math.round(cell.winRate * 100)

                          return (
                            <td
                              key={colFaction.id}
                              className={`matrix-cell ${cell.isProjected ? 'matrix-cell--projected' : ''}`}
                              style={{ background: winRateColor(cell.winRate) }}
                              title={
                                cell.isProjected
                                  ? `No direct votes yet — Elo-projected ${percent}% win rate`
                                  : `${percent}% win rate over ${cell.totalVotes} vote${cell.totalVotes === 1 ? '' : 's'}`
                              }
                            >
                              {percent}%
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
