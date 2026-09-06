import {
  sortOrders,
  matchesPaymentMethod,
  matchesChannel,
  TransactionSortOption,
  PaymentMethodFilter,
  FilterStatus,
  DateRangeMode,
} from '../screens/transactions/transactionUtils'
import type { Order } from '../types'

describe('Transaction Filter & Sort Logic', () => {
  const makeOrder = (
    id: string,
    orderNumber: string,
    createdAt: string,
    totalAmount: number | string,
    status: string,
    channelName: string,
    paymentMethod: string,
    customerName?: string
  ): Order => ({
    id,
    order_number: orderNumber,
    created_at: createdAt,
    total_amount: totalAmount,
    status,
    channel_id: `chan-${id}`,
    channel: {
      id: `chan-${id}`,
      name: channelName,
      type: channelName.toLowerCase().includes('pos') ? 'pos' : 'social_media',
      is_active: true,
    },
    payments: [
      {
        id: `pay-${id}`,
        order_id: id,
        payment_method: paymentMethod,
        amount: totalAmount,
        status: 'completed',
      },
    ],
    customer: customerName ? { id: `cust-${id}`, name: customerName, phone: '012345678' } : undefined,
  })

  const sampleOrders: Order[] = [
    makeOrder('o1', 'ORD-003', '2026-09-01T10:00:00Z', 15.5, 'completed', 'Store POS', 'Cash', 'Alice'),
    makeOrder('o2', 'ORD-001', '2026-09-05T14:30:00Z', 120.0, 'completed', 'Facebook - KC Shop', 'ABA KHQR', 'Bob'),
    makeOrder('o3', 'ORD-004', '2026-08-20T08:15:00Z', 45.0, 'pending', 'Telegram - KC Sport', 'Card', 'Charlie'),
    makeOrder('o4', 'ORD-002', '2026-09-06T12:00:00Z', 85.75, 'paid', 'Store POS', 'Bank Transfer', 'Diana'),
    makeOrder('o5', 'ORD-005', '2026-09-04T16:45:00Z', 30.0, 'cancelled', 'TikTok - KC Shop', 'Cash', 'Eve'),
  ]

  describe('Sorting Logic (sortOrders)', () => {
    it('sorts by DEFAULT / Newest First (created_at DESC)', () => {
      const sorted = sortOrders(sampleOrders, 'DEFAULT')
      expect(sorted.map((o) => o.order_number)).toEqual([
        'ORD-002', // Sep 6
        'ORD-001', // Sep 5
        'ORD-005', // Sep 4
        'ORD-003', // Sep 1
        'ORD-004', // Aug 20
      ])
    })

    it('sorts by OLDEST (created_at ASC)', () => {
      const sorted = sortOrders(sampleOrders, 'OLDEST')
      expect(sorted.map((o) => o.order_number)).toEqual([
        'ORD-004', // Aug 20
        'ORD-003', // Sep 1
        'ORD-005', // Sep 4
        'ORD-001', // Sep 5
        'ORD-002', // Sep 6
      ])
    })

    it('sorts by AMOUNT_DESC (High → Low)', () => {
      const sorted = sortOrders(sampleOrders, 'AMOUNT_DESC')
      expect(sorted.map((o) => o.order_number)).toEqual([
        'ORD-001', // $120.00
        'ORD-002', // $85.75
        'ORD-004', // $45.00
        'ORD-005', // $30.00
        'ORD-003', // $15.50
      ])
    })

    it('sorts by AMOUNT_ASC (Low → High)', () => {
      const sorted = sortOrders(sampleOrders, 'AMOUNT_ASC')
      expect(sorted.map((o) => o.order_number)).toEqual([
        'ORD-003', // $15.50
        'ORD-005', // $30.00
        'ORD-004', // $45.00
        'ORD-002', // $85.75
        'ORD-001', // $120.00
      ])
    })

    it('sorts by ORDER_NUM_ASC (Order # A → Z)', () => {
      const sorted = sortOrders(sampleOrders, 'ORDER_NUM_ASC')
      expect(sorted.map((o) => o.order_number)).toEqual([
        'ORD-001',
        'ORD-002',
        'ORD-003',
        'ORD-004',
        'ORD-005',
      ])
    })

    it('handles numeric string total_amounts correctly', () => {
      const stringAmountOrders = [
        makeOrder('s1', 'ORD-S1', '2026-09-01T00:00:00Z', '5.00', 'completed', 'POS', 'Cash'),
        makeOrder('s2', 'ORD-S2', '2026-09-01T00:00:00Z', '100.50', 'completed', 'POS', 'Cash'),
        makeOrder('s3', 'ORD-S3', '2026-09-01T00:00:00Z', '25.00', 'completed', 'POS', 'Cash'),
      ]
      const desc = sortOrders(stringAmountOrders, 'AMOUNT_DESC')
      expect(desc.map((o) => o.order_number)).toEqual(['ORD-S2', 'ORD-S3', 'ORD-S1'])
    })
  })

  describe('Payment Method Matching (matchesPaymentMethod)', () => {
    it('matches ALL payment methods when filter is ALL', () => {
      sampleOrders.forEach((o) => {
        expect(matchesPaymentMethod(o, 'ALL')).toBe(true)
      })
    })

    it('matches CASH payment method', () => {
      expect(matchesPaymentMethod(sampleOrders[0], 'CASH')).toBe(true) // Cash
      expect(matchesPaymentMethod(sampleOrders[1], 'CASH')).toBe(false) // ABA
      expect(matchesPaymentMethod(sampleOrders[4], 'CASH')).toBe(true) // Cash
    })

    it('matches ABA / KHQR payment method', () => {
      expect(matchesPaymentMethod(sampleOrders[1], 'ABA')).toBe(true) // ABA KHQR
      expect(matchesPaymentMethod(sampleOrders[0], 'ABA')).toBe(false) // Cash
    })

    it('matches CARD payment method', () => {
      expect(matchesPaymentMethod(sampleOrders[2], 'CARD')).toBe(true) // Card
      expect(matchesPaymentMethod(sampleOrders[0], 'CARD')).toBe(false) // Cash
    })

    it('matches BANK payment method', () => {
      expect(matchesPaymentMethod(sampleOrders[3], 'BANK')).toBe(true) // Bank Transfer
      expect(matchesPaymentMethod(sampleOrders[0], 'BANK')).toBe(false) // Cash
    })
  })

  describe('Sales Channel Matching (matchesChannel)', () => {
    it('matches ALL channels when filter is ALL', () => {
      sampleOrders.forEach((o) => {
        expect(matchesChannel(o, 'ALL')).toBe(true)
      })
    })

    it('matches channel by cleaned shop name', () => {
      // o2 has channel "Facebook - KC Shop", clean shop name is "KC Shop"
      expect(matchesChannel(sampleOrders[1], 'KC Shop')).toBe(true)
      // o3 has channel "Telegram - KC Sport", clean shop name is "KC Sport"
      expect(matchesChannel(sampleOrders[2], 'KC Sport')).toBe(true)
      expect(matchesChannel(sampleOrders[2], 'KC Shop')).toBe(false)
    })

    it('matches channel by raw channel name or platform', () => {
      expect(matchesChannel(sampleOrders[0], 'Store POS')).toBe(true)
      expect(matchesChannel(sampleOrders[1], 'Facebook')).toBe(true)
      expect(matchesChannel(sampleOrders[2], 'Telegram')).toBe(true)
      expect(matchesChannel(sampleOrders[4], 'TikTok')).toBe(true)
    })
  })

  describe('Active Filters Count Calculation', () => {
    function computeActiveFiltersCount(
      sortBy: TransactionSortOption,
      statusFilter: FilterStatus,
      dateRange: DateRangeMode,
      channelFilter: string,
      paymentMethodFilter: PaymentMethodFilter
    ): number {
      let count = 0
      if (sortBy !== 'DEFAULT') count++
      if (statusFilter !== 'ALL') count++
      if (dateRange !== 'all') count++
      if (channelFilter !== 'ALL') count++
      if (paymentMethodFilter !== 'ALL') count++
      return count
    }

    it('counts 0 active filters when all criteria are default', () => {
      const count = computeActiveFiltersCount('DEFAULT', 'ALL', 'all', 'ALL', 'ALL')
      expect(count).toBe(0)
    })

    it('counts accurately when multiple filters and custom sort are active', () => {
      const count = computeActiveFiltersCount('AMOUNT_DESC', 'COMPLETED', '7d', 'Store POS', 'CASH')
      expect(count).toBe(5)
    })
  })

  describe('Full Multi-Criteria Filter & Sort Pipeline', () => {
    it('filters by status=completed, payment=CASH, and sorts by AMOUNT_DESC', () => {
      const paymentMethodFilter: PaymentMethodFilter = 'CASH'
      const sortBy: TransactionSortOption = 'AMOUNT_DESC'

      const filtered = sampleOrders.filter((o) => {
        const st = (o.status || '').toLowerCase()
        if (st !== 'completed' && st !== 'paid') return false
        if (!matchesPaymentMethod(o, paymentMethodFilter)) return false
        return true
      })

      const sorted = sortOrders(filtered, sortBy)

      // Only o1 ('completed', Cash, $15.5) matches.
      // o4 is 'paid', but its payment is Bank Transfer.
      // o5 is Cash, but status is 'cancelled'.
      expect(sorted.length).toBe(1)
      expect(sorted[0].order_number).toBe('ORD-003')
    })

    it('filters by channel=Store POS and sorts by created_at OLDEST', () => {
      const channelFilter = 'Store POS'
      const sortBy: TransactionSortOption = 'OLDEST'

      const filtered = sampleOrders.filter((o) => matchesChannel(o, channelFilter))
      const sorted = sortOrders(filtered, sortBy)

      // o1 (Sep 1) and o4 (Sep 6) are Store POS.
      expect(sorted.map((o) => o.order_number)).toEqual(['ORD-003', 'ORD-002'])
    })
  })
})
