const STORAGE_KEY = '40k-tier-list:voter-name'
const MAX_NAME_LENGTH = 40

const NAME_ADJECTIVES = [
  'Grim',
  'Iron',
  'Silent',
  'Crimson',
  'Void',
  'Ashen',
  'Feral',
  'Stalwart',
  'Ancient',
  'Ember',
  'Ghost',
  'Ruthless',
]

const NAME_NOUNS = [
  'Ranger',
  'Warlord',
  'Tactician',
  'Prophet',
  'Sentinel',
  'Raven',
  'Wolf',
  'Reaper',
  'Warden',
  'Herald',
  'Outrider',
  'Sage',
]

function generateRandomName(): string {
  const adjective = NAME_ADJECTIVES[Math.floor(Math.random() * NAME_ADJECTIVES.length)]
  const noun = NAME_NOUNS[Math.floor(Math.random() * NAME_NOUNS.length)]
  const number = Math.floor(Math.random() * 90) + 10
  return `${adjective} ${noun} ${number}`
}

/**
 * Every voter gets a name — auto-generated and persisted the first time
 * this is called if they haven't picked one — rather than voting fully
 * anonymously. This keeps the Leaderboard and activity feed meaningful for
 * everyone, and gives vote-spam mitigation something to key on, without
 * requiring login or any hidden tracking identifier.
 */
export function getVoterName(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY)
    if (existing) return existing

    const generated = generateRandomName()
    localStorage.setItem(STORAGE_KEY, generated)
    return generated
  } catch {
    return generateRandomName()
  }
}

export function setVoterName(name: string): string {
  const trimmed = name.trim().slice(0, MAX_NAME_LENGTH)
  const next = trimmed || generateRandomName()
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // localStorage unavailable — name just won't persist across reloads.
  }
  return next
}
