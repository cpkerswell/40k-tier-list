const STORAGE_KEY = '40k-tier-list:voter-name'
const MAX_NAME_LENGTH = 40

export function getVoterName(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function setVoterName(name: string): string | null {
  const trimmed = name.trim().slice(0, MAX_NAME_LENGTH)
  if (trimmed) {
    localStorage.setItem(STORAGE_KEY, trimmed)
  } else {
    localStorage.removeItem(STORAGE_KEY)
  }
  return getVoterName()
}
