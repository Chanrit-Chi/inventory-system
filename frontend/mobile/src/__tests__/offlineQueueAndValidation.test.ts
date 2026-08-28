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
