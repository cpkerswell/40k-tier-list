import type { IconKey } from '../components/icons'
import type { Faction, FactionType } from '../types'

export interface FactionTheme {
  color: string
  icon: IconKey
}

// Keyed by exact faction name. Colors are hand-picked to evoke each faction's
// tabletop palette; icons are original abstract glyphs, not reproductions of
// any Games Workshop artwork.
const FACTION_THEMES: Record<string, FactionTheme> = {
  'Space Marines': { color: '#d4af37', icon: 'shield' },
  'Blood Angels': { color: '#a8203a', icon: 'drop' },
  'Dark Angels': { color: '#2f5233', icon: 'wings' },
  'Space Wolves': { color: '#5b7c99', icon: 'claw' },
  'Black Templars': { color: '#3a3a3a', icon: 'blade' },
  Deathwatch: { color: '#2e2e2e', icon: 'skull' },
  'Astra Militarum': { color: '#5a5f3a', icon: 'star' },
  'Adeptus Custodes': { color: '#e0a020', icon: 'crown' },
  'Adepta Sororitas': { color: '#c23b3b', icon: 'flame' },
  'Adeptus Mechanicus': { color: '#8a5a2b', icon: 'gear' },
  'Grey Knights': { color: '#7d93b3', icon: 'blade' },
  'Imperial Knights': { color: '#35507a', icon: 'shield' },

  'Chaos Space Marines': { color: '#7a1f1f', icon: 'chaosStar' },
  'Death Guard': { color: '#5c6b2f', icon: 'drop' },
  'Thousand Sons': { color: '#2b4a7a', icon: 'eye' },
  'World Eaters': { color: '#8b1a1a', icon: 'skull' },
  'Chaos Daemons': { color: '#5b2a86', icon: 'chaosStar' },
  'Chaos Knights': { color: '#4a1f1f', icon: 'chaosStar' },
  "Emperor's Children": { color: '#b83f7a', icon: 'chaosStar' },

  Aeldari: { color: '#2f8f8f', icon: 'blade' },
  Drukhari: { color: '#4a1a4a', icon: 'claw' },
  Necrons: { color: '#2f8f5f', icon: 'gear' },
  Orks: { color: '#5b8a2f', icon: 'claw' },
  "T'au Empire": { color: '#3a7ca5', icon: 'bolt' },
  Tyranids: { color: '#8b3fa8', icon: 'swarm' },
  'Genestealer Cults': { color: '#6b4a2f', icon: 'swarm' },
  'Leagues of Votann': { color: '#a5682a', icon: 'gear' },
}

const TYPE_FALLBACK_THEMES: Record<FactionType, FactionTheme> = {
  Imperium: { color: '#d4af37', icon: 'shield' },
  Chaos: { color: '#7a1f1f', icon: 'chaosStar' },
  Xenos: { color: '#2f8f8f', icon: 'star' },
}

export function getFactionTheme(faction: Faction): FactionTheme {
  return FACTION_THEMES[faction.name] ?? TYPE_FALLBACK_THEMES[faction.faction_type]
}
