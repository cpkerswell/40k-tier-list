import type { CSSProperties } from 'react'
import { useState } from 'react'
import {
  DISPOSITIONS,
  getDispositionsForFaction,
  toggleFactionDisposition,
  type Disposition,
} from '../lib/dispositions'
import { getFactionTheme, readableInk } from '../lib/factionTheme'
import type { Faction, FactionType } from '../types'
import { FactionIcon } from './icons'

interface PreferencesViewProps {
  groupSlug: string
  factions: Faction[]
  loading: boolean
  error: string | null
  knownFactionIds: Set<string>
  onToggle: (factionId: string) => void
}

interface PreferenceChipAccentStyle extends CSSProperties {
  '--accent': string
  '--accent-ink': string
}

const TYPE_ORDER: FactionType[] = ['Imperium', 'Chaos', 'Xenos']

export function PreferencesView({
  groupSlug,
  factions,
  loading,
  error,
  knownFactionIds,
  onToggle,
}: PreferencesViewProps) {
  const [dispositionsByFaction, setDispositionsByFaction] = useState<Record<string, Disposition[]>>(
    () => {
      const map: Record<string, Disposition[]> = {}
      factions.forEach((faction) => {
        map[faction.id] = getDispositionsForFaction(groupSlug, faction.id)
      })
      return map
    },
  )

  function handleToggleDisposition(factionId: string, disposition: Disposition) {
    const next = toggleFactionDisposition(groupSlug, factionId, disposition)
    setDispositionsByFaction((previous) => ({ ...previous, [factionId]: next }))
  }

  if (loading) {
    return <p className="status-message">Summoning the factions...</p>
  }

  if (error) {
    return <p className="status-message status-message--error">{error}</p>
  }

  if (factions.length === 0) {
    return <p className="status-message">No factions yet. Add some in Supabase to get started.</p>
  }

  return (
    <div className="preferences">
      <p className="preferences__intro">
        Mark the factions you actually know. Match-ups between two factions you know are shown
        first on the Vote tab, before anything else. For a known faction, tag the Force
        Dispositions you play it with (or think are strong) — you'll be shown one of them when
        that faction comes up in a vote.
      </p>

      {TYPE_ORDER.map((type) => {
        const group = factions.filter((faction) => faction.faction_type === type)
        if (group.length === 0) return null

        return (
          <div key={type} className="preferences__group">
            <h2 className="preferences__group-title">{type}</h2>
            <div className="preferences__list">
              {group.map((faction) => {
                const theme = getFactionTheme(faction)
                const known = knownFactionIds.has(faction.id)
                const style: PreferenceChipAccentStyle = {
                  '--accent': theme.color,
                  '--accent-ink': readableInk(theme.color),
                }
                const taggedDispositions = dispositionsByFaction[faction.id] ?? []

                return (
                  <div key={faction.id} className="preference-item">
                    <button
                      type="button"
                      className={`preference-chip ${known ? 'preference-chip--active' : ''}`}
                      style={style}
                      aria-pressed={known}
                      onClick={() => onToggle(faction.id)}
                    >
                      <FactionIcon icon={theme.icon} className="preference-chip__icon" />
                      <span>{faction.name}</span>
                    </button>
                    {known && (
                      <div className="disposition-tags" style={style}>
                        {DISPOSITIONS.map((disposition) => {
                          const active = taggedDispositions.includes(disposition)
                          return (
                            <button
                              key={disposition}
                              type="button"
                              className={`disposition-tag ${active ? 'disposition-tag--active' : ''}`}
                              aria-pressed={active}
                              onClick={() => handleToggleDisposition(faction.id, disposition)}
                            >
                              {disposition}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
