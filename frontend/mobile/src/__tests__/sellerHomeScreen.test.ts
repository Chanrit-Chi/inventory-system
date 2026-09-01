jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    select: (obj: any) => obj.android || obj.default,
  },
  Alert: {
    alert: jest.fn(),
  },
  StyleSheet: {
    create: (styles: any) => styles,
  },
}))

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}))

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(),
  fetch: jest.fn().mockResolvedValue({ isConnected: true }),
}))

import { matchPermission, ROLE_DEFAULT_PERMISSIONS } from '../hooks/usePermissions'

describe('Seller Role and Home Screen Permission Logic', () => {
  describe('SELLER default permissions', () => {
    const sellerGrants = ROLE_DEFAULT_PERMISSIONS['SELLER']

    it('does not have financial reports permission (reports:view)', () => {
      const hasReports = sellerGrants.some((p) => matchPermission(p, 'reports:view'))
      expect(hasReports).toBe(false)
    })

    it('does not have inventory restocking/adjustment permissions', () => {
      const canRestock = sellerGrants.some((p) => matchPermission(p, 'inventory:restock'))
      const canAdjust = sellerGrants.some((p) => matchPermission(p, 'inventory:adjust'))
      expect(canRestock).toBe(false)
      expect(canAdjust).toBe(false)
    })

    it('has POS checkout, quotations, customer, and transaction view permissions', () => {
      const canPos = sellerGrants.some((p) => matchPermission(p, 'pos:checkout'))
      const canQuote = sellerGrants.some((p) => matchPermission(p, 'quotations:create'))
      const canCustomer = sellerGrants.some((p) => matchPermission(p, 'customers:view'))
      const canTx = sellerGrants.some((p) => matchPermission(p, 'transactions:view'))

      expect(canPos).toBe(true)
      expect(canQuote).toBe(true)
      expect(canCustomer).toBe(true)
      expect(canTx).toBe(true)
    })
  })

  describe('ADMIN / MANAGER default permissions', () => {
    const adminGrants = ROLE_DEFAULT_PERMISSIONS['ADMIN']
    const managerGrants = ROLE_DEFAULT_PERMISSIONS['MANAGER']

    it('ADMIN has reports:view and inventory:*', () => {
      const hasReports = adminGrants.some((p) => matchPermission(p, 'reports:view'))
      const canRestock = adminGrants.some((p) => matchPermission(p, 'inventory:restock'))
      expect(hasReports).toBe(true)
      expect(canRestock).toBe(true)
    })

    it('MANAGER has reports:view and inventory:adjust / restock', () => {
      const hasReports = managerGrants.some((p) => matchPermission(p, 'reports:view'))
      const canRestock = managerGrants.some((p) => matchPermission(p, 'inventory:restock'))
      expect(hasReports).toBe(true)
      expect(canRestock).toBe(true)
    })
  })
})
