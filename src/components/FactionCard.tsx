import type { CSSProperties } from 'react'
import { getFactionTheme } from '../lib/factionTheme'
import type { FactionOutcome } from '../lib/voteHistory'
import type { Faction } from '../types'
import { FactionIcon } from './icons'

interface FactionCardAccentStyle extends CSSProperties {
  '--accent': string
}

interface FactionCardProps {
  faction: Faction
  onSelect: () => void
  disabled: boolean
  lastOutcome?: FactionOutcome | null
}

function describeLastOutcome(outcome: FactionOutcome): string {
  if (outcome.result === 'won') return `Last time: beat ${outcome.opponentName}`
  if (outcome.result === 'lost') return `Last time: lost to ${outcome.opponentName}`
  return `Last time: drew with ${outcome.opponentName}`
}

export function FactionCard({ faction, onSelect, disabled, lastOutcome }: FactionCardProps) {
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
      {lastOutcome && (
        <span className="faction-card__last-outcome">{describeLastOutcome(lastOutcome)}</span>
      )}
    </button>
  )
}
