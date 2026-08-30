import { describe, it, expect, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { usePosStore, type CartItem, type HoldCart } from '../src/stores/posStore.ts'

// In-memory mock localStorage
class MockLocalStorage {
  private store: Record<string, string> = {}

  getItem(key: string): string | null {
    return this.store[key] ?? null
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value)
  }

  removeItem(key: string): void {
    delete this.store[key]
  }

  clear(): void {
    this.store = {}
  }
}

// Setup global mock environment
const mockStorage = new MockLocalStorage()
;(globalThis as any).localStorage = mockStorage
;(globalThis as any).window = globalThis

describe('Milestone 3 POS Store & Logic Verification', () => {
  beforeEach(() => {
    mockStorage.clear()
    setActivePinia(createPinia())
  })

  describe('1. Cart Persistence Across Page Refreshes & localStorage', () => {
    it('initializes with default empty tab when localStorage is empty', () => {
      const store = usePosStore()
      assert.equal(store.tabs.length, 1)
      assert.equal(store.activeTabId, 'cart-1')
      assert.equal(store.items.length, 0)
      assert.equal(store.isCartEmpty, true)
      assert.equal(store.subtotal, 0)
      assert.equal(store.total, 0)
    })

    it('persists cart items, customer, seller, notes, and restores them accurately upon reload', () => {
      const store1 = usePosStore()

      // Add item
      store1.addToCart({
        id: 'prod-101',
        name: 'Artisan Espresso Beans 250g',
        selling_price: 18.5,
        sku: 'COF-ESP-250',
        barcode: '8851234567890',
      }, undefined, 2)

      // Set customer
      store1.setCustomer({
        id: 'cust-99',
        name: 'Sarah Connor',
        phone: '+1-555-0199',
        loyalty_tier: 'Gold',
      })

      // Set seller
      store1.setSeller({
        id: 7,
        name: 'Alex Cashier',
        email: 'alex@omnipos.io',
        role: 'CASHIER',
        is_active: true,
      })

      // Set order discounts & taxes
      store1.setOrderDiscount('percentage', 10)
      store1.setTaxRate(8)
      store1.setOrderNotes('Handle with care')

      // Verify raw localStorage payload
      const rawStored = mockStorage.getItem('omnipos_pos_cart')
      assert.ok(rawStored, 'localStorage should have omnipos_pos_cart entry')
      const parsed = JSON.parse(rawStored)
      assert.equal(parsed.tabs.length, 1)
      assert.equal(parsed.tabs[0].items.length, 1)
      assert.equal(parsed.tabs[0].items[0].name, 'Artisan Espresso Beans 250g')
      assert.equal(parsed.tabs[0].items[0].quantity, 2)
      assert.equal(parsed.tabs[0].customer.name, 'Sarah Connor')
      assert.equal(parsed.activeSeller.name, 'Alex Cashier')

      // Simulate browser reload by spinning up a fresh Pinia store instance
      setActivePinia(createPinia())
      const store2 = usePosStore()

      assert.equal(store2.items.length, 1)
      assert.equal(store2.items[0].product_id, 'prod-101')
      assert.equal(store2.items[0].quantity, 2)
      assert.equal(store2.items[0].price, 18.5)
      assert.equal(store2.customer?.name, 'Sarah Connor')
      assert.equal(store2.customer?.loyalty_tier, 'Gold')
      assert.equal(store2.activeSeller?.name, 'Alex Cashier')
      assert.equal(store2.discountType, 'percentage')
      assert.equal(store2.discountValue, 10)
      assert.equal(store2.taxRate, 8)
      assert.equal(store2.orderNotes, 'Handle with care')
    })

    it('gracefully recovers from corrupted or invalid localStorage JSON', () => {
      mockStorage.setItem('omnipos_pos_cart', 'CORRUPT_JSON_DATA{{{{')
      setActivePinia(createPinia())
      const store = usePosStore()

      assert.equal(store.tabs.length, 1)
      assert.equal(store.items.length, 0)
      assert.equal(store.isCartEmpty, true)
    })
  })

  describe('2. Financial & Math Calculations Stress-Testing', () => {
    it('calculates line item totals with no discount', () => {
      const store = usePosStore()
      const item = store.addToCart({
        id: 'p1',
        name: 'Item 1',
        selling_price: 25.0,
      }, undefined, 3)

      assert.equal(store.getLineTotal(item), 75.0)
      assert.equal(store.subtotal, 75.0)
    })

    it('calculates line item totals with percentage discount', () => {
      const store = usePosStore()
      const item = store.addToCart({
        id: 'p1',
        name: 'Item 1',
        selling_price: 40.0,
      }, undefined, 2) // Raw = $80.00

      store.applyLineDiscount(item.id, 'percentage', 25) // 25% of $80 = $20 discount
      assert.equal(store.getLineTotal(store.items[0]), 60.0)
      assert.equal(store.subtotal, 60.0)

      // Test 100% line discount
      store.applyLineDiscount(item.id, 'percentage', 100)
      assert.equal(store.getLineTotal(store.items[0]), 0.0)

      // Test >100% line discount clamping to 0
      store.applyLineDiscount(item.id, 'percentage', 150)
      assert.equal(store.getLineTotal(store.items[0]), 0.0)
    })

    it('calculates line item totals with flat discount', () => {
      const store = usePosStore()
      const item = store.addToCart({
        id: 'p1',
        name: 'Item 1',
        selling_price: 15.0,
      }, undefined, 3) // Raw = $45.00

      store.applyLineDiscount(item.id, 'flat', 10) // $10 off
      assert.equal(store.getLineTotal(store.items[0]), 35.0)
      assert.equal(store.subtotal, 35.0)

      // Flat discount exceeding line total clamps to 0
      store.applyLineDiscount(item.id, 'flat', 50)
      assert.equal(store.getLineTotal(store.items[0]), 0.0)
    })

    it('calculates cart-level percentage and flat discounts correctly', () => {
      const store = usePosStore()
      store.addToCart({ id: 'p1', name: 'Item 1', selling_price: 50 }, undefined, 2) // Subtotal = 100

      // 15% cart discount
      store.setOrderDiscount('percentage', 15)
      assert.equal(store.subtotal, 100)
      assert.equal(store.orderDiscountAmount, 15)
      assert.equal(store.discountedSubtotal, 85)
      assert.equal(store.total, 85)

      // Flat $30 cart discount
      store.setOrderDiscount('flat', 30)
      assert.equal(store.orderDiscountAmount, 30)
      assert.equal(store.discountedSubtotal, 70)
      assert.equal(store.total, 70)

      // Flat discount larger than subtotal
      store.setOrderDiscount('flat', 150)
      assert.equal(store.orderDiscountAmount, 100)
      assert.equal(store.discountedSubtotal, 0)
      assert.equal(store.total, 0)
    })

    it('computes tax and delivery fees correctly on discounted subtotal', () => {
      const store = usePosStore()
      // Subtotal = $200
      store.addToCart({ id: 'p1', name: 'Item 1', selling_price: 100 }, undefined, 2)

      // 10% discount -> discounted subtotal = $180
      store.setOrderDiscount('percentage', 10)
      assert.equal(store.discountedSubtotal, 180)

      // 10% Tax rate on $180 -> $18 tax
      store.setTaxRate(10)
      assert.equal(store.taxAmount, 18)

      // Delivery fee of $15
      store.setDelivery({ isDelivery: true, fee: 15, address: '123 Main St' })
      assert.equal(store.deliveryFee, 15)

      // Total = 180 (discounted subtotal) + 18 (tax) + 15 (delivery) = 213
      assert.equal(store.total, 213)
      assert.equal(store.grandTotal, 213)

      // If isDelivery is false, deliveryFee is excluded from total
      store.setDelivery({ isDelivery: false, fee: 15 })
      assert.equal(store.total, 198)
    })

    it('computes change amount accurately for cash transactions', () => {
      const store = usePosStore()
      store.addToCart({ id: 'p1', name: 'Coffee', selling_price: 4.50 }, undefined, 2) // Subtotal = $9.00
      store.setTaxRate(10) // Tax = $0.90 -> Total = $9.90

      store.setPaymentMethod('CASH')

      // Exact payment
      store.setTenderedAmount(9.90)
      assert.ok(Math.abs(store.changeAmount - 0) < 0.0001)

      // Overpayment ($20 bill tendered for $9.90 total -> $10.10 change)
      store.setTenderedAmount(20.00)
      assert.ok(Math.abs(store.changeAmount - 10.10) < 0.0001)

      // Underpayment ($5 tendered for $9.90 total -> change is 0)
      store.setTenderedAmount(5.00)
      assert.equal(store.changeAmount, 0)

      // Non-cash method -> change is 0
      store.setPaymentMethod('CARD')
      assert.equal(store.changeAmount, 0)
    })

    it('handles floating-point edge cases without NaN or broken precision', () => {
      const store = usePosStore()
      // $19.99 * 3 = 59.97
      store.addToCart({ id: 'p1', name: 'Item', selling_price: 19.99 }, undefined, 3)
      assert.ok(Math.abs(store.subtotal - 59.97) < 0.0001)

      // 15% discount -> 59.97 * 0.15 = 8.9955 -> discounted subtotal = 50.9745
      store.setOrderDiscount('percentage', 15)
      assert.ok(Math.abs(store.orderDiscountAmount - 8.9955) < 0.0001)
      assert.ok(Math.abs(store.discountedSubtotal - 50.9745) < 0.0001)

      // 8.25% Tax -> 50.9745 * 0.0825 = 4.20539625
      store.setTaxRate(8.25)
      assert.ok(Math.abs(store.taxAmount - 4.20539625) < 0.0001)

      // Total = 50.9745 + 4.20539625 = 55.17989625
      assert.ok(Math.abs(store.total - 55.17989625) < 0.0001)
    })
  })

  describe('3. Multi-Cart Tab Holding, Resuming, and Switching', () => {
    it('allows creating, switching, and closing multiple tabs independently', () => {
      const store = usePosStore()

      // Tab 1: add 2 apples
      store.addToCart({ id: 'apple', name: 'Apple', selling_price: 2.0 }, undefined, 2)
      assert.equal(store.items.length, 1)
      assert.equal(store.subtotal, 4.0)

      // Create Tab 2
      const tab2Id = store.createTab('Table 5')
      assert.equal(store.tabs.length, 2)
      assert.equal(store.activeTabId, tab2Id)
      assert.equal(store.items.length, 0) // New tab is empty

      // Add 1 steak to Tab 2
      store.addToCart({ id: 'steak', name: 'Ribeye Steak', selling_price: 35.0 }, undefined, 1)
      assert.equal(store.items.length, 1)
      assert.equal(store.subtotal, 35.0)

      // Switch back to Tab 1
      store.switchTab('cart-1')
      assert.equal(store.activeTabId, 'cart-1')
      assert.equal(store.items.length, 1)
      assert.equal(store.items[0].name, 'Apple')
      assert.equal(store.subtotal, 4.0)

      // Switch to Tab 2
      store.switchTab(tab2Id)
      assert.equal(store.items[0].name, 'Ribeye Steak')
      assert.equal(store.subtotal, 35.0)

      // Close Tab 2
      store.closeTab(tab2Id)
      assert.equal(store.tabs.length, 1)
      assert.equal(store.activeTabId, 'cart-1')
      assert.equal(store.items[0].name, 'Apple')
    })

    it('holds an active cart and parks it in heldOrders', () => {
      const store = usePosStore()
      store.addToCart({ id: 'wine', name: 'Red Wine', selling_price: 45.0 }, undefined, 2)
      store.setCustomer({ name: 'Lord Voldemort', phone: '000-000' })
      store.setOrderNotes('Seat at quiet corner')

      assert.equal(store.items.length, 1)
      assert.equal(store.heldOrders.length, 0)

      const held = store.holdCurrentOrder('VIP Table 1')
      assert.ok(held)
      assert.equal(store.heldOrders.length, 1)
      assert.equal(store.heldOrders[0].name, 'VIP Table 1')
      assert.equal(store.heldOrders[0].items.length, 1)
      assert.equal(store.heldOrders[0].items[0].name, 'Red Wine')
      assert.equal(store.heldOrders[0].customer?.name, 'Lord Voldemort')
      assert.equal(store.heldOrders[0].notes, 'Seat at quiet corner')

      // Active cart should now be empty
      assert.equal(store.items.length, 0)
      assert.equal(store.customer, null)
      assert.equal(store.isCartEmpty, true)
    })

    it('refuses to hold an empty cart', () => {
      const store = usePosStore()
      const held = store.holdCurrentOrder('Empty Cart')
      assert.equal(held, null)
      assert.equal(store.heldOrders.length, 0)
    })

    it('resumes held order into current tab if empty, or new tab if active tab has items', () => {
      const store = usePosStore()

      // Put order on hold
      store.addToCart({ id: 'p1', name: 'Pizza Margherita', selling_price: 16.0 }, undefined, 1)
      const held = store.holdCurrentOrder('Order #1')!
      assert.equal(store.heldOrders.length, 1)

      // 1. Resume into empty active tab
      store.resumeHeldOrder(held.id)
      assert.equal(store.heldOrders.length, 0)
      assert.equal(store.items.length, 1)
      assert.equal(store.items[0].name, 'Pizza Margherita')

      // Hold it again
      const held2 = store.holdCurrentOrder('Order #2')!

      // Put another item in active tab
      store.addToCart({ id: 'p2', name: 'Tiramisu', selling_price: 8.0 }, undefined, 1)

      // 2. Resume while active tab is occupied -> should spawn new tab
      store.resumeHeldOrder(held2.id)
      assert.equal(store.heldOrders.length, 0)
      assert.equal(store.tabs.length, 2)
      assert.equal(store.items[0].name, 'Pizza Margherita')

      // Original tab still has Tiramisu
      store.switchTab(store.tabs[0].id)
      assert.equal(store.items[0].name, 'Tiramisu')
    })
  })

  describe('4. Variant Selection & Catalog Actions', () => {
    it('adds single variant or base product to cart', () => {
      const store = usePosStore()
      const item = store.addToCart({
        id: 'prod-shirt',
        name: 'Classic Linen Shirt',
        selling_price: 55.0,
        sku: 'SHIRT-BASE',
      })

      assert.equal(item.product_id, 'prod-shirt')
      assert.equal(item.variant_id, undefined)
      assert.equal(item.name, 'Classic Linen Shirt')
      assert.equal(item.sku, 'SHIRT-BASE')
      assert.equal(item.price, 55.0)
      assert.equal(item.quantity, 1)
    })

    it('adds specific variant of a multi-variant product with attribute names', () => {
      const store = usePosStore()
      const product = {
        id: 'prod-hoodie',
        name: 'Omni Hoodie',
        selling_price: 70.0,
        sku: 'HOODIE-BASE',
      }

      const variantL = {
        id: 'var-hoodie-l-black',
        sku: 'HOODIE-BLK-L',
        selling_price: 75.0,
        quantity_on_hand: 12,
        attribute_values: [
          { attribute: { name: 'Size' }, value_name: 'L' },
          { attribute: { name: 'Color' }, value_name: 'Black' },
        ],
      }

      const item = store.addToCart(product, variantL, 2)
      assert.equal(item.product_id, 'prod-hoodie')
      assert.equal(item.variant_id, 'var-hoodie-l-black')
      assert.equal(item.variant_name, 'L / Black')
      assert.equal(item.sku, 'HOODIE-BLK-L')
      assert.equal(item.price, 75.0)
      assert.equal(item.quantity, 2)
      assert.equal(store.subtotal, 150.0)

      // Adding the same variant increments quantity
      store.addToCart(product, variantL, 3)
      assert.equal(store.items.length, 1)
      assert.equal(store.items[0].quantity, 5)
      assert.equal(store.subtotal, 375.0)

      // Adding a different variant adds a second line item
      const variantM = {
        id: 'var-hoodie-m-white',
        sku: 'HOODIE-WHT-M',
        selling_price: 70.0,
        quantity_on_hand: 5,
        attribute_values: [
          { attribute: { name: 'Size' }, value_name: 'M' },
          { attribute: { name: 'Color' }, value_name: 'White' },
        ],
      }
      store.addToCart(product, variantM, 1)
      assert.equal(store.items.length, 2)
      assert.equal(store.items[1].variant_id, 'var-hoodie-m-white')
      assert.equal(store.items[1].quantity, 1)
      assert.equal(store.subtotal, 445.0)
    })

    it('updates quantity and automatically removes line item when quantity reaches 0', () => {
      const store = usePosStore()
      const item = store.addToCart({ id: 'p1', name: 'Item', selling_price: 10 }, undefined, 2)
      assert.equal(store.items[0].quantity, 2)

      store.updateQuantity(item.id, 5)
      assert.equal(store.items[0].quantity, 5)

      // Set quantity to 0 -> should delete item from cart
      store.updateQuantity(item.id, 0)
      assert.equal(store.items.length, 0)
      assert.equal(store.isCartEmpty, true)
    })
  })

  describe('5. Barcode Scanner Buffer Simulation', () => {
    it('simulates rapid keystrokes (<60ms) ending with Enter into barcode buffer', () => {
      let barcodeKeyBuffer = ''
      let lastKeyTimestamp = 0
      const processedCodes: string[] = []

      function simulateKey(key: string, timestamp: number) {
        if (key === 'Enter') {
          if (barcodeKeyBuffer.length >= 3) {
            processedCodes.push(barcodeKeyBuffer)
            barcodeKeyBuffer = ''
            return
          }
          barcodeKeyBuffer = ''
        } else if (key.length === 1) {
          if (timestamp - lastKeyTimestamp < 60 || barcodeKeyBuffer.length === 0) {
            barcodeKeyBuffer += key
          } else {
            barcodeKeyBuffer = key
          }
          lastKeyTimestamp = timestamp
        }
      }

      // Simulate barcode scanner typing "8851234567890" with 10ms intervals
      const barcode = '8851234567890'
      let t = 1000
      for (const ch of barcode) {
        simulateKey(ch, t)
        t += 10
      }
      simulateKey('Enter', t + 10)

      assert.equal(processedCodes.length, 1)
      assert.equal(processedCodes[0], '8851234567890')

      // Simulate slow manual typing (150ms intervals) -> buffer resets between keys
      t = 2000
      for (const ch of 'ABCDEF') {
        simulateKey(ch, t)
        t += 150 // >60ms
      }
      simulateKey('Enter', t + 10)

      // Only the last key was in buffer before Enter, so length was 1 (< 3) -> discarded
      assert.equal(processedCodes.length, 1)
    })
  })
})
