import { flushSync } from 'react-dom'

/**
 * Applies a React state update inside a View Transition when the browser
 * supports it, so elements tagged with `viewTransitionName` glide/cross-fade
 * to their new positions instead of snapping. Falls back to a plain update
 * where unsupported (older Safari/Firefox) — no animation, but no breakage.
 *
 * flushSync forces the DOM to update synchronously inside the transition
 * callback so the browser captures the correct "after" snapshot.
 */
export function withViewTransition(update: () => void): void {
  if (typeof document !== 'undefined' && typeof document.startViewTransition === 'function') {
    document.startViewTransition(() => flushSync(update))
  } else {
    update()
  }
}
