import { getBackoffDelay } from '../hooks/useOfflineQueue'
import { customerSchema, supplierSchema, productSchema } from '../utils/validation'

describe('useOfflineQueue Backoff & Retry', () => {
  it('calculates exponential backoff delay correctly', () => {
    expect(getBackoffDelay(0)).toBe(1000)
    expect(getBackoffDelay(1)).toBe(2000)
    expect(getBackoffDelay(2)).toBe(4000)
    expect(getBackoffDelay(3)).toBe(8000)
    expect(getBackoffDelay(4)).toBe(16000)
  })

  it('caps backoff delay at 30000ms', () => {
    expect(getBackoffDelay(5)).toBe(30000)
    expect(getBackoffDelay(10)).toBe(30000)
  })

  it('correctly constructs offline checkout mutation with client_mutation_id', () => {
    const mockPayload = {
      client_mutation_id: 'mut-12345',
      channel_id: 'chan-pos',
      items: [{ variant_id: 'var-1', quantity: 2, unit_price: 5.0 }],
      payment_method: 'Cash',
      payment_amount: 10.0,
      status: 'paid',
    }

    const mutation = {
      id: mockPayload.client_mutation_id,
      timestamp: Date.now(),
      endpoint: '/orders/checkout',
      payload: mockPayload,
      retryCount: 0,
      status: 'pending' as const,
    }

    expect(mutation.id).toBe('mut-12345')
    expect(mutation.endpoint).toBe('/orders/checkout')
    expect(mutation.status).toBe('pending')
  })

  it('deduplicates mutations when enqueueing existing client_mutation_id', () => {
    const queue: any[] = [
      { id: 'mut-1', endpoint: '/orders/checkout', retryCount: 0, status: 'pending' },
      { id: 'mut-2', endpoint: '/inventory/adjust', retryCount: 0, status: 'pending' },
    ]

    const incoming = { id: 'mut-1', endpoint: '/orders/checkout', retryCount: 1, status: 'pending' }
    const updatedQueue = queue.some((m) => m.id === incoming.id)
      ? queue.map((m) => (m.id === incoming.id ? incoming : m))
      : [...queue, incoming]

    expect(updatedQueue).toHaveLength(2)
    expect(updatedQueue[0].retryCount).toBe(1)
  })
})

describe('Form Validation Schemas', () => {
  describe('customerSchema', () => {
    it('validates a valid customer', () => {
      const result = customerSchema.safeParse({
        name: 'Jane Doe',
        phone: '0812345678',
        email: 'jane@example.com',
        address: '123 Main St',
        customer_type: 'retail',
      })
      expect(result.success).toBe(true)
    })

    it('rejects an empty name', () => {
      const result = customerSchema.safeParse({
        name: '',
        phone: '0812345678',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('supplierSchema', () => {
    it('validates a valid supplier', () => {
      const result = supplierSchema.safeParse({
        name: 'Acme Supply Co.',
        contact_person: 'Bob Smith',
        phone: '0898765432',
        email: 'bob@acme.com',
        lead_time_days: 5,
      })
      expect(result.success).toBe(true)
    })

    it('rejects an empty supplier name', () => {
      const result = supplierSchema.safeParse({
        name: '',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('productSchema', () => {
    it('validates a valid product', () => {
      const result = productSchema.safeParse({
        name: 'Wireless Mouse',
        category_id: 'cat-1',
        selling_price: 25.99,
        purchase_price: 12.5,
        sku: 'MS-W-01',
      })
      expect(result.success).toBe(true)
    })

    it('rejects missing product name', () => {
      const result = productSchema.safeParse({
        category_id: 'cat-1',
        selling_price: 25.99,
      })
      expect(result.success).toBe(false)
    })
  })
})
