import type { CSSProperties } from 'react'
import { getFactionTheme } from '../lib/factionTheme'
import { assignTiers, TIER_ORDER } from '../lib/tiers'
import type { Faction, Tier } from '../types'
import { FactionIcon } from './icons'

interface TierChipAccentStyle extends CSSProperties {
  '--accent': string
}

interface TierListViewProps {
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

export function TierListView({ factions, loading, error }: TierListViewProps) {
  if (loading) {
    return <p className="status-message">Consulting the Adeptus Administratum...</p>
  }

  if (error) {
    return <p className="status-message status-message--error">{error}</p>
  }

  if (factions.length === 0) {
    return <p className="status-message">No factions yet. Add some in Supabase to get started.</p>
  }

  const tierByFactionId = assignTiers(factions)
  const grouped: Record<Tier, Faction[]> = { S: [], A: [], B: [], C: [], D: [] }
  factions.forEach((faction) => {
    const tier = tierByFactionId.get(faction.id) ?? 'D'
    grouped[tier].push(faction)
  })

  return (
    <div className="tier-list">
      {TIER_ORDER.map((tier) => (
        <div key={tier} className={`tier-row tier-row--${tier}`}>
          <div className="tier-row__label">{TIER_LABELS[tier]}</div>
          <div className="tier-row__factions">
            {grouped[tier].map((faction) => {
              const theme = getFactionTheme(faction)
              const style: TierChipAccentStyle = { '--accent': theme.color }
              return (
                <span key={faction.id} className="tier-chip" style={style}>
                  <FactionIcon icon={theme.icon} className="tier-chip__icon" />
                  {faction.name}
                </span>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
