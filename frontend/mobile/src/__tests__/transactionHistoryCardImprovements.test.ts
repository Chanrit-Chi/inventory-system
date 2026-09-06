import {
  getChannelCleanShopName,
  getCustomerDisplayAddress,
  getChannelPlatformMeta,
} from '../screens/transactions/transactionUtils'
import type { Order } from '../types'

describe('Transaction History Card Improvements', () => {
  describe('Channel Shop Name Extraction (Platform Prefix Removal)', () => {
    it('strips "Platform - ShopName" prefixes and keeps clean shop name', () => {
      expect(getChannelCleanShopName('Telegram - KC Shop')).toBe('KC Shop')
      expect(getChannelCleanShopName('Facebook - KC Shop')).toBe('KC Shop')
      expect(getChannelCleanShopName('Facebook - KC Sport')).toBe('KC Sport')
      expect(getChannelCleanShopName('Instagram - KC Shop')).toBe('KC Shop')
      expect(getChannelCleanShopName('TikTok - KC Shop')).toBe('KC Shop')
      expect(getChannelCleanShopName('WhatsApp - Outlet 1')).toBe('Outlet 1')
      expect(getChannelCleanShopName('Shopee - KC Official')).toBe('KC Official')
      expect(getChannelCleanShopName('Lazada - KC Store')).toBe('KC Store')
    })

    it('handles various delimiters like ":", "|", "/", and bullet points', () => {
      expect(getChannelCleanShopName('Facebook : KC Shop')).toBe('KC Shop')
      expect(getChannelCleanShopName('Telegram | KC Shop')).toBe('KC Shop')
      expect(getChannelCleanShopName('Instagram / KC Fashion')).toBe('KC Fashion')
      expect(getChannelCleanShopName('FB • KC Boutique')).toBe('KC Boutique')
      expect(getChannelCleanShopName('TG - KC Shop')).toBe('KC Shop')
      expect(getChannelCleanShopName('IG - KC Shop')).toBe('KC Shop')
    })

    it('handles space-separated prefixes like "Telegram KC Shop"', () => {
      expect(getChannelCleanShopName('Telegram KC Shop')).toBe('KC Shop')
      expect(getChannelCleanShopName('Facebook KC Sport')).toBe('KC Sport')
    })

    it('handles platform suffixes like "KC Shop - Facebook" and "KC Shop (Telegram)"', () => {
      expect(getChannelCleanShopName('KC Shop - Facebook')).toBe('KC Shop')
      expect(getChannelCleanShopName('KC Shop (Telegram)')).toBe('KC Shop')
      expect(getChannelCleanShopName('KC Sport (FB)')).toBe('KC Sport')
    })

    it('preserves non-social or non-prefixed store channel names', () => {
      expect(getChannelCleanShopName('Main Physical Store POS')).toBe('Main Physical Store POS')
      expect(getChannelCleanShopName('Official E-Commerce Web')).toBe('Official E-Commerce Web')
      expect(getChannelCleanShopName('Retail Counter 2')).toBe('Retail Counter 2')
    })

    it('preserves standalone platform names when no shop name exists', () => {
      expect(getChannelCleanShopName('Facebook')).toBe('Facebook')
      expect(getChannelCleanShopName('Telegram')).toBe('Telegram')
    })

    it('handles null, undefined or empty input safely', () => {
      expect(getChannelCleanShopName(null)).toBeNull()
      expect(getChannelCleanShopName(undefined)).toBeNull()
      expect(getChannelCleanShopName('')).toBeNull()
      expect(getChannelCleanShopName('   ')).toBeNull()
    })
  })

  describe('Customer Address Resolution', () => {
    const baseOrder: Order = {
      id: 'ord-123',
      order_number: 'ORD-20260906-001',
      channel_id: 'chan-pos',
      status: 'completed',
      total_amount: '45.00',
      created_at: new Date().toISOString(),
    }

    it('returns customer profile address when available', () => {
      const orderWithCustomer: Order = {
        ...baseOrder,
        customer: {
          id: 'cust-1',
          name: 'Sokha Chan',
          phone: '+85512345678',
          address: 'Street 271, Toul Tum Poung, Phnom Penh',
        },
      }
      expect(getCustomerDisplayAddress(orderWithCustomer)).toBe(
        'Street 271, Toul Tum Poung, Phnom Penh'
      )
    })

    it('prioritizes specific street delivery address over in-store pickup notes', () => {
      const deliveryOrder: Order = {
        ...baseOrder,
        delivery_address: 'House 12, St 2004',
        region: 'Sen Sok',
        customer: {
          id: 'cust-2',
          name: 'Dara Sam',
          phone: '+85598765432',
          address: 'Old Home Address, Tuol Kork',
        },
      }
      expect(getCustomerDisplayAddress(deliveryOrder)).toBe('House 12, St 2004, Sen Sok')
    })

    it('ignores generic "In-store POS counter pickup" and falls back to customer profile address', () => {
      const posOrder: Order = {
        ...baseOrder,
        delivery_address: 'In-store POS counter pickup',
        region: 'Phnom Penh',
        customer: {
          id: 'cust-3',
          name: 'Bopha Keo',
          phone: '+85511223344',
          address: 'Street 310, BKK1, Phnom Penh',
        },
      }
      expect(getCustomerDisplayAddress(posOrder)).toBe('Street 310, BKK1, Phnom Penh')
    })

    it('falls back to order region if no customer address or delivery street is present', () => {
      const regionOnlyOrder: Order = {
        ...baseOrder,
        region: 'Siem Reap',
      }
      expect(getCustomerDisplayAddress(regionOnlyOrder)).toBe('Siem Reap')
    })

    it('returns null when neither customer address nor delivery address is provided', () => {
      const anonymousWalkIn: Order = {
        ...baseOrder,
        customer: null,
        delivery_address: undefined,
        region: undefined,
      }
      expect(getCustomerDisplayAddress(anonymousWalkIn)).toBeNull()
    })
  })

  describe('Platform Icon & Color Meta Mapping', () => {
    it('returns appropriate icon and colors for Telegram', () => {
      const meta = getChannelPlatformMeta({ id: 'c1', name: 'Telegram - KC Shop', code: 'TG-KC' })
      expect(meta?.icon).toBe('paper-plane')
      expect(meta?.color).toBe('#0284C7')
    })

    it('returns appropriate icon and colors for Facebook', () => {
      const meta = getChannelPlatformMeta({ id: 'c2', name: 'Facebook - KC Shop', code: 'FB-KC' })
      expect(meta?.icon).toBe('logo-facebook')
      expect(meta?.color).toBe('#1877F2')
    })

    it('returns appropriate icon and colors for Instagram', () => {
      const meta = getChannelPlatformMeta({ id: 'c3', name: 'Instagram - KC Shop', code: 'IG-KC' })
      expect(meta?.icon).toBe('logo-instagram')
      expect(meta?.color).toBe('#E1306C')
    })

    it('returns appropriate icon and colors for TikTok', () => {
      const meta = getChannelPlatformMeta({ id: 'c4', name: 'TikTok - KC Shop', code: 'TK-KC' })
      expect(meta?.icon).toBe('logo-tiktok')
    })
  })
})
