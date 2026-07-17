export type FactionType = 'Imperium' | 'Chaos' | 'Xenos'

export interface Faction {
  id: string
  name: string
  faction_type: FactionType
  elo_rating: number
  games_played: number
}

export type Tier = 'S' | 'A' | 'B' | 'C' | 'D'
