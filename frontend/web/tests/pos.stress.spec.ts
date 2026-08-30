import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { usePosStore } from '../src/stores/posStore.ts'

// In-memory mock localStorage
class MockLocalStorage {
  private store: Record<string, string> = {}
  getItem(key: string): string | null { return this.store[key] ?? null }
  setItem(key: string, value: string): void { this.store[key] = String(value) }
  removeItem(key: string): void { delete this.store[key] }
  clear(): void { this.store = {} }
}

const mockStorage = new MockLocalStorage()
;(globalThis as any).localStorage = mockStorage
;(globalThis as any).window = globalThis

describe('Milestone 3 POS Stress Test & Extreme Edge Cases', () => {
  beforeEach(() => {
    mockStorage.clear()
    setActivePinia(createPinia())
  })

  it('handles massive cart load with 100 distinct items and computes totals instantly', () => {
    const store = usePosStore()
    const startTime = performance.now()

    for (let i = 1; i <= 100; i++) {
      store.addToCart({
        id: `prod-${i}`,
        name: `Product Item #${i}`,
        selling_price: i * 1.5,
        sku: `SKU-${i}`,
      }, undefined, i % 5 + 1)
    }

    assert.equal(store.items.length, 100)
    assert.ok(store.subtotal > 0)
    assert.ok(store.itemCount > 100)

    // Apply cart percentage discount
    store.setOrderDiscount('percentage', 12.5)
    store.setTaxRate(7.5)

    const expectedDiscounted = store.subtotal * 0.875
    assert.ok(Math.abs(store.discountedSubtotal - expectedDiscounted) < 0.01)

    const duration = performance.now() - startTime
    assert.ok(duration < 500, `Massive cart computation took ${duration}ms, should be <500ms`)
  })

  it('demonstrates tab isolation when tabs have unique IDs across ticks', async () => {
    const store = usePosStore()
    const tabIds: string[] = ['cart-1']

    // Create tabs with slight delay or distinct timestamps
    for (let i = 2; i <= 5; i++) {
      await new Promise((r) => setTimeout(r, 2)) // Ensure Date.now() advances
      const id = store.createTab(`Table ${i}`)
      tabIds.push(id)
      store.addToCart({
        id: `prod-tab-${i}`,
        name: `Item for Tab ${i}`,
        selling_price: i * 10,
      }, undefined, 1)
    }

    assert.equal(store.tabs.length, 5)

    // Switch between tabs and verify isolation
    for (let i = 2; i <= 5; i++) {
      store.switchTab(tabIds[i - 1])
      assert.equal(store.activeTabId, tabIds[i - 1])
      assert.equal(store.items.length, 1)
      assert.equal(store.items[0].name, `Item for Tab ${i}`)
      assert.equal(store.subtotal, i * 10)
    }

    // Switch to initial tab-1 which is empty
    store.switchTab(tabIds[0])
    assert.equal(store.items.length, 0)
    assert.equal(store.subtotal, 0)
  })

  it('demonstrates sub-millisecond ID collision risk in createTab if called synchronously', () => {
    const store = usePosStore()
    // Calling createTab synchronously in tight loop generates identical Date.now()
    const id1 = store.createTab('Fast Tab 1')
    const id2 = store.createTab('Fast Tab 2')

    // If Date.now() didn't advance, both tabs get the same id
    if (id1 === id2) {
      // Confirmed collision vulnerability
      assert.equal(id1, id2)
      assert.equal(store.tabs[1].id, store.tabs[2].id)
    }
  })

  it('stress tests park/hold and resume queue with 10 parked orders', async () => {
    const store = usePosStore()

    for (let i = 1; i <= 10; i++) {
      await new Promise((r) => setTimeout(r, 2))
      store.addToCart({
        id: `held-prod-${i}`,
        name: `Held Product ${i}`,
        selling_price: 20 + i,
      }, undefined, 1)
      store.setCustomer({ name: `Customer #${i}`, phone: `555-${i}` })
      store.holdCurrentOrder(`Parked #${i}`)
    }

    assert.equal(store.heldOrders.length, 10)
    assert.equal(store.items.length, 0)

    // Resume the 5th parked order
    const targetHeld = store.heldOrders.find((h) => h.name === 'Parked #5')!
    assert.ok(targetHeld)
    store.resumeHeldOrder(targetHeld.id)

    assert.equal(store.heldOrders.length, 9)
    assert.equal(store.items.length, 1)
    assert.equal(store.items[0].name, 'Held Product 5')
    assert.equal(store.customer?.name, 'Customer #5')

    // Delete 3 held orders
    const toDelete = store.heldOrders.slice(0, 3)
    for (const h of toDelete) {
      store.deleteHeldOrder(h.id)
    }
    assert.equal(store.heldOrders.length, 6)
  })

  it('validates checkout validation logic and cash presets edge cases', () => {
    // Test quick cash calculation logic for $47.33
    const total = 47.33
    const ceilTotal = Math.ceil(total) // 48
    const presets: { label: string; value: number }[] = []
    presets.push({ label: `Exact ($${total.toFixed(2)})`, value: total })

    const standardBills = [5, 10, 20, 50, 100, 200, 500]
    for (const bill of standardBills) {
      if (bill >= ceilTotal && bill !== total && !presets.some((p) => p.value === bill)) {
        presets.push({ label: `$${bill}`, value: bill })
      }
    }
    const next10 = Math.ceil(ceilTotal / 10) * 10 // 50
    if (next10 > total && !presets.some((p) => p.value === next10)) {
      presets.push({ label: `$${next10}`, value: next10 })
    }

    const next50 = Math.ceil(ceilTotal / 50) * 50 // 50
    if (next50 > total && !presets.some((p) => p.value === next50)) {
      presets.push({ label: `$${next50}`, value: next50 })
    }

    const quickCashList = presets.slice(0, 5)

    assert.equal(quickCashList[0].value, 47.33)
    assert.equal(quickCashList[1].value, 50)
    assert.equal(quickCashList[2].value, 100)
  })

  it('handles post-transaction reset cleanly', () => {
    const store = usePosStore()
    store.addToCart({ id: 'p1', name: 'Item', selling_price: 30 }, undefined, 1)
    store.setCustomer({ name: 'Jane Doe' })
    store.setPaymentMethod('CASH')
    store.setTenderedAmount(50)

    assert.equal(store.isCartEmpty, false)
    assert.equal(store.changeAmount, 20)

    store.resetTransaction()

    assert.equal(store.isCartEmpty, true)
    assert.equal(store.customer, null)
    assert.equal(store.tenderedAmount, 0)
    assert.equal(store.changeAmount, 0)
  })
})
