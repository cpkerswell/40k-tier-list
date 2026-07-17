import type { CSSProperties } from 'react'
import { getFactionTheme } from '../lib/factionTheme'
import type { Faction } from '../types'
import { FactionIcon } from './icons'

interface FactionCardAccentStyle extends CSSProperties {
  '--accent': string
}

interface FactionCardProps {
  faction: Faction
  onSelect: () => void
  disabled: boolean
}

export function FactionCard({ faction, onSelect, disabled }: FactionCardProps) {
  const theme = getFactionTheme(faction)
  const style: FactionCardAccentStyle = { '--accent': theme.color }

  return (
    <button
      type="button"
      className="faction-card"
      style={style}
      onClick={onSelect}
      disabled={disabled}
    >
      <FactionIcon icon={theme.icon} className="faction-card__icon" />
      <span className="faction-card__type">{faction.faction_type}</span>
      <span className="faction-card__name">{faction.name}</span>
    </button>
  )
}
