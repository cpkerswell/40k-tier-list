import type { Tier } from '../types'

export function TierPill({ tier }: { tier: Tier }) {
  return <span className={`tier-pill tier-pill--${tier}`}>{tier}</span>
}
