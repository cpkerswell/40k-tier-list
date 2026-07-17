import type { CSSProperties } from 'react'
import { getFactionTheme } from '../lib/factionTheme'
import type { Faction, FactionType } from '../types'
import { FactionIcon } from './icons'

interface PreferencesViewProps {
  factions: Faction[]
  loading: boolean
  error: string | null
  knownFactionIds: Set<string>
  onToggle: (factionId: string) => void
}

interface PreferenceChipAccentStyle extends CSSProperties {
  '--accent': string
}

const TYPE_ORDER: FactionType[] = ['Imperium', 'Chaos', 'Xenos']

export function PreferencesView({
  factions,
  loading,
  error,
  knownFactionIds,
  onToggle,
}: PreferencesViewProps) {
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
        first on the Vote tab, before anything else.
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
                const style: PreferenceChipAccentStyle = { '--accent': theme.color }

                return (
                  <button
                    key={faction.id}
                    type="button"
                    className={`preference-chip ${known ? 'preference-chip--active' : ''}`}
                    style={style}
                    aria-pressed={known}
                    onClick={() => onToggle(faction.id)}
                  >
                    <FactionIcon icon={theme.icon} className="preference-chip__icon" />
                    <span>{faction.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
