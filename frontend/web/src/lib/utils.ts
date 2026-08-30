import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * shadcn-vue's `cn()` utility — combines clsx + tailwind-merge so that later
 * Tailwind utility classes win over earlier ones, even when both are present.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
