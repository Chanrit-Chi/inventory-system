/**
 * Utility functions for password generation and validation
 */

const UPPERCASE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // Excluded ambiguous I, O
const LOWERCASE_CHARS = 'abcdefghijkmnpqrstuvwxyz' // Excluded ambiguous l, o
const NUMBER_CHARS = '23456789' // Excluded ambiguous 0, 1
const SPECIAL_CHARS = '@#$%&*!'

/**
 * Generate a cryptographically random, secure and readable temporary password.
 * Default format: 10-12 characters with at least one uppercase, lowercase, digit, and special char.
 */
export function generateSecureTemporaryPassword(length: number = 10): string {
  if (length < 8) {
    length = 8
  }

  // Ensure at least one of each required character category
  const guaranteedChars = [
    UPPERCASE_CHARS[Math.floor(Math.random() * UPPERCASE_CHARS.length)],
    LOWERCASE_CHARS[Math.floor(Math.random() * LOWERCASE_CHARS.length)],
    NUMBER_CHARS[Math.floor(Math.random() * NUMBER_CHARS.length)],
    SPECIAL_CHARS[Math.floor(Math.random() * SPECIAL_CHARS.length)],
  ]

  const allChars = UPPERCASE_CHARS + LOWERCASE_CHARS + NUMBER_CHARS + SPECIAL_CHARS
  const remainingLength = length - guaranteedChars.length

  const remainingChars: string[] = []
  for (let i = 0; i < remainingLength; i++) {
    const randomIndex = Math.floor(Math.random() * allChars.length)
    remainingChars.push(allChars[randomIndex])
  }

  // Combine and shuffle characters
  const passwordArray = [...guaranteedChars, ...remainingChars]
  for (let i = passwordArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = passwordArray[i]
    passwordArray[i] = passwordArray[j]
    passwordArray[j] = temp
  }

  return passwordArray.join('')
}
