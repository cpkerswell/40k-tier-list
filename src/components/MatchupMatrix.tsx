import type { CSSProperties } from 'react'
import { useState } from 'react'
import { useMatchupVotes } from '../hooks/useMatchupVotes'
import { getFactionTheme, readableInk } from '../lib/factionTheme'
import { computeMatrixCell, winRateColor } from '../lib/matrix'
import { getMatrixFactionIds, toggleMatrixFaction } from '../lib/matrixSelection'
import type { Faction, FactionType } from '../types'
import { FactionIcon } from './icons'

interface MatchupMatrixProps {
  groupSlug: string
  isGlobal: boolean
  factions: Faction[]
}

interface AccentStyle extends CSSProperties {
  '--accent': string
  '--accent-ink': string
}

const TYPE_ORDER: FactionType[] = ['Imperium', 'Chaos', 'Xenos']

export function MatchupMatrix({ groupSlug, isGlobal, factions }: MatchupMatrixProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(() => getMatrixFactionIds(groupSlug))
  const { votes, loading, error } = useMatchupVotes(groupSlug, isGlobal, selectedIds)

  function handleToggle(factionId: string) {
    setSelectedIds(toggleMatrixFaction(groupSlug, factionId))
  }

  const selectedFactions = selectedIds
    .map((id) => factions.find((faction) => faction.id === id))
    .filter((faction): faction is Faction => Boolean(faction))

  return (
    <div className="matrix-section">
      <h2 className="matrix-section__title">Matchup Matrix</h2>
      <p className="matrix-section__intro">
        Pick factions to compare head-to-head. Green means a strong match-up, red means weak,
        based on actual votes between that pair — or an Elo-projected estimate (dashed border)
        when they haven't faced off yet.
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

      {selectedFactions.length < 2 && (
        <p className="status-message">Pick at least two factions to see the matrix.</p>
      )}

      {selectedFactions.length >= 2 && (
        <>
          {loading && <p className="status-message">Loading matchups...</p>}
          {error && <p className="status-message status-message--error">{error}</p>}
          {!loading && !error && (
            <div className="matrix-scroll">
              <table className="matrix-table">
                <thead>
                  <tr>
                    <th className="matrix-table__corner" />
                    {selectedFactions.map((colFaction) => {
                      const theme = getFactionTheme(colFaction)
                      const style: AccentStyle = {
                        '--accent': theme.color,
                        '--accent-ink': readableInk(theme.color),
                      }
                      return (
                        <th key={colFaction.id} className="matrix-table__header" style={style}>
                          <FactionIcon icon={theme.icon} className="matrix-table__header-icon" />
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {selectedFactions.map((rowFaction) => {
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
                        {selectedFactions.map((colFaction) => {
                          if (rowFaction.id === colFaction.id) {
                            return (
                              <td key={colFaction.id} className="matrix-cell matrix-cell--self">
                                &mdash;
                              </td>
                            )
                          }

                          const cell = computeMatrixCell(
                            votes,
                            rowFaction.id,
                            colFaction.id,
                            rowFaction.elo_rating,
                            colFaction.elo_rating,
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
