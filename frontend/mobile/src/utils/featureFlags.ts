/**
 * Feature release date helper.
 * Returns 'New' if the feature release date is within the given active window (default: 7 days / 1 week).
 * After 7 days have passed from the release date, this automatically returns undefined,
 * cleanly expiring the badge with zero manual maintenance.
 */
export function getFeatureNewBadge(releaseDateISO: string, activeDays = 7): string | undefined {
  try {
    const releaseTime = new Date(releaseDateISO).getTime()
    if (isNaN(releaseTime)) return undefined
    const now = Date.now()
    const ageInDays = (now - releaseTime) / (1000 * 60 * 60 * 24)
    return ageInDays >= 0 && ageInDays <= activeDays ? 'New' : undefined
  } catch {
    return undefined
  }
}
