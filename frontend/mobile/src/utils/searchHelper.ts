/**
 * Multi-field search helper.
 * Safe against null/undefined, whitespace-trimmed, and case-insensitive.
 * Supports strings, numbers, booleans, and arrays of strings.
 */
export function matchSearch(
  query: string,
  ...candidates: Array<string | number | null | undefined | boolean | Array<string | number | null | undefined>>
): boolean {
  if (!query || !query.trim()) return true
  const q = query.trim().toLowerCase()
  for (const item of candidates) {
    if (item === null || item === undefined) continue
    if (Array.isArray(item)) {
      if (item.some((sub) => sub !== null && sub !== undefined && String(sub).toLowerCase().includes(q))) {
        return true
      }
    } else if (String(item).toLowerCase().includes(q)) {
      return true
    }
  }
  return false
}
