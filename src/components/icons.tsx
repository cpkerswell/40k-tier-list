import type { ReactNode } from 'react'

export type IconKey =
  | 'shield'
  | 'wings'
  | 'drop'
  | 'claw'
  | 'blade'
  | 'skull'
  | 'star'
  | 'crown'
  | 'flame'
  | 'gear'
  | 'eye'
  | 'bolt'
  | 'chaosStar'
  | 'swarm'

const ICON_PATHS: Record<IconKey, ReactNode> = {
  shield: <path d="M12 2.5 19.5 5.5V11.5C19.5 16.5 16.2 20 12 21.5 7.8 20 4.5 16.5 4.5 11.5V5.5Z" />,
  wings: (
    <>
      <path d="M12 13C9 7 5 6 2 9" />
      <path d="M12 13C15 7 19 6 22 9" />
      <path d="M12 13V17" />
    </>
  ),
  drop: <path d="M12 3C12 3 6 12 6 16.5A6 6 0 0 0 18 16.5C18 12 12 3 12 3Z" />,
  claw: (
    <>
      <path d="M5 5 9 19" />
      <path d="M10 4 13 20" />
      <path d="M15 5 18 18" />
    </>
  ),
  blade: (
    <>
      <path d="M12 2V15" />
      <path d="M8 15H16" />
      <path d="M12 15V20" />
      <circle cx="12" cy="21" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  skull: (
    <>
      <circle cx="12" cy="10" r="6" />
      <circle cx="9.5" cy="10" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="10" r="1.3" fill="currentColor" stroke="none" />
      <path d="M9 15H15L14 18H10Z" />
    </>
  ),
  star: <path d="M12 2 14.5 9H22L15.8 13.3 18 21 12 16.3 6 21 8.2 13.3 2 9H9.5Z" />,
  crown: <path d="M4 18H20L18 8 14 12 12 6 10 12 6 8Z" />,
  flame: (
    <path d="M12 2C9 7 6 9 6 13.5A6 6 0 0 0 18 13.5C18 11 16.5 10 16 8 15.5 10 14.5 10.5 14 9 13.5 6 13 4 12 2Z" />
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <path d="M12 4V6.5" />
      <path d="M12 17.5V20" />
      <path d="M4 12H6.5" />
      <path d="M17.5 12H20" />
      <path d="M6.34 6.34 8.1 8.1" />
      <path d="M15.9 15.9 17.66 17.66" />
      <path d="M17.66 6.34 15.9 8.1" />
      <path d="M8.1 15.9 6.34 17.66" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12C5 6 19 6 22 12 19 18 5 18 2 12Z" />
      <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
    </>
  ),
  bolt: <path d="M13 2 5 14H11L9 22 20 9H13Z" fill="currentColor" stroke="none" />,
  chaosStar: <path d="M12 2 14 9 21 7 16 12 21 17 14 15 12 22 10 15 3 17 8 12 3 7 10 9Z" />,
  swarm: (
    <>
      <circle cx="7" cy="8" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="6" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="17" cy="8" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="16" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="7" cy="17" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="17" cy="17" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
}

interface FactionIconProps {
  icon: IconKey
  className?: string
}

export function FactionIcon({ icon, className }: FactionIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[icon]}
    </svg>
  )
}
