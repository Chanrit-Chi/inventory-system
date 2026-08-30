import type { BankAccount } from '../../types'

export const INITIAL_BANK_ACCOUNTS: BankAccount[] = []

export const POPULAR_BANKS = [
  { name: 'ABA Bank', color: '#005F83', icon: 'qr-code' as const },
  { name: 'ACLEDA Bank', color: '#0D3880', icon: 'business' as const },
  { name: 'Wing Bank', color: '#6EBE44', icon: 'phone-portrait' as const },
  { name: 'Canadia Bank', color: '#B91C1C', icon: 'card' as const },
  { name: 'Sathapana Bank', color: '#1E3A8A', icon: 'wallet' as const },
  { name: 'Custom Bank', color: '#475569', icon: 'cash' as const },
]
