export const DEFAULT_GROUP_SLUG = 'default'

const SLUG_PATTERN = /^[a-z0-9-]{1,40}$/

/**
 * Reads the group slug from the first path segment (e.g. /groupA -> "groupa"),
 * falling back to the default (shared) group for the root URL or anything
 * that doesn't look like a safe slug.
 */
export function getGroupSlugFromLocation(): string {
  const segment = window.location.pathname.split('/').filter(Boolean)[0]
  if (!segment) return DEFAULT_GROUP_SLUG

  const normalized = segment.toLowerCase()
  return SLUG_PATTERN.test(normalized) ? normalized : DEFAULT_GROUP_SLUG
}
