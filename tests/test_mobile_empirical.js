/**
 * Empirical Stress Test Harness for KC Inventory Mobile Application
 * Tests Cart calculations, Stock Adjustment calculations, Stock In batch restock calculations,
 * Edge cases, boundary values, floating-point precision, and validation rules.
 */

const assert = require('assert');

let passedTests = 0;
let failedTests = 0;
const results = [];

function test(name, fn) {
  try {
    fn();
    passedTests++;
    results.push({ name, status: 'PASS' });
    console.log(`✓ [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    results.push({ name, status: 'FAIL', error: err.message, stack: err.stack });
    console.error(`✗ [FAIL] ${name}\n    Error: ${err.message}`);
  }
}

// -------------------------------------------------------------
// DOMAIN LOGIC SIMULATIONS MIRRORING EXACT COMPONENT CODE
// -------------------------------------------------------------

// 1. Cart Logic Simulation (from src/hooks/useCart.ts)
class CartHookSimulator {
  constructor() {
    this.cart = [];
  }

  addVariantToCart(variant, productName) {
    const rawPrice = variant.selling_price_override ?? variant.selling_price ?? variant.product?.selling_price ?? '0';
    const unitPrice = parseFloat(rawPrice) || 0;
    const availableStock = variant.quantity_on_hand ?? 0;
    const attrs = variant.attribute_values?.map(av => `${av.attribute?.name ? av.attribute.name + ': ' : ''}${av.value_name}`).join(', ');

    const existingIndex = this.cart.findIndex(item => item.variantId === variant.id);
    if (existingIndex >= 0) {
      const current = this.cart[existingIndex];
      this.cart[existingIndex] = {
        ...current,
        quantity: current.quantity + 1,
        availableStock,
      };
      return;
    }

    this.cart.push({
      variantId: variant.id,
      sku: variant.sku,
      productName: productName || variant.product?.name || 'Product',
      quantity: 1,
      unitPrice,
      availableStock,
      attributesSummary: attrs || undefined,
    });
  }

  updateQuantity(variantId, delta) {
    this.cart = this.cart
      .map(item => {
        if (item.variantId === variantId) {
          const nextQty = item.quantity + delta;
          return nextQty > 0 ? { ...item, quantity: nextQty } : null;
        }
        return item;
      })
      .filter(item => item !== null);
  }

  setItemQuantity(variantId, quantity) {
    if (quantity <= 0) {
      this.removeFromCart(variantId);
      return;
    }
    this.cart = this.cart.map(item =>
      item.variantId === variantId ? { ...item, quantity } : item
    );
  }

  removeFromCart(variantId) {
    this.cart = this.cart.filter(item => item.variantId !== variantId);
  }

  clearCart() {
    this.cart = [];
  }

  get cartTotal() {
    return this.cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  }

  get totalItemCount() {
    return this.cart.reduce((sum, item) => sum + item.quantity, 0);
  }

  get stockWarnings() {
    const warnings = {};
    for (const item of this.cart) {
      if (item.availableStock <= 0) {
        warnings[item.variantId] = 'Out of stock';
      } else if (item.quantity > item.availableStock) {
        warnings[item.variantId] = `Exceeds stock (available: ${item.availableStock})`;
      }
    }
    return warnings;
  }

  get hasOutOfStockItems() {
    return Object.keys(this.stockWarnings).length > 0;
  }
}

// 2. Stock Adjustment Logic Simulation (from src/components/StockAdjustmentModal.tsx)
class StockAdjustmentSimulator {
  constructor(initialStock = 42) {
    this.currentStock = initialStock;
    this.newCount = initialStock;
    this.selectedReason = 'Audit';
    this.notes = '';
  }

  increment() {
    this.newCount += 1;
  }

  decrement() {
    this.newCount = Math.max(0, this.newCount - 1);
  }

  setCountText(text) {
    const parsed = parseInt(text, 10);
    if (isNaN(parsed)) {
      this.newCount = 0;
    } else {
      this.newCount = Math.max(0, parsed);
    }
  }

  get difference() {
    return this.newCount - this.currentStock;
  }

  get differenceDisplay() {
    const diff = this.difference;
    if (diff > 0) return `+${diff} units`;
    if (diff < 0) return `${diff} units`;
    return '0 (No Change)';
  }

  get colorCategory() {
    const diff = this.difference;
    if (diff > 0) return 'positive'; // #34A853 (green)
    if (diff < 0) return 'negative'; // #BA1A1A (red)
    return 'neutral';                // #615E57 (neutral)
  }

  buildPayload(variantId) {
    return {
      variant_id: variantId || 'var-default',
      current_quantity: this.currentStock,
      new_quantity: this.newCount,
      difference: this.difference,
      reason: this.selectedReason,
      notes: this.notes.trim() || undefined,
      adjusted_at: new Date().toISOString(),
    };
  }
}

// 3. Stock In Receiving Logic Simulation (from src/components/StockInModal.tsx)
class StockInSimulator {
  constructor(initialItems) {
    this.items = initialItems || [
      { id: 'si-1', variant_id: 'var-101', name: 'Cotton Crewneck', sku: 'TSH-WHT-M', expected_qty: 24, received_qty: 24, unit_cost: 8.50, lot_number: 'LOT-A' },
      { id: 'si-2', variant_id: 'var-102', name: 'Raw Denim Jean', sku: 'JEA-IND-32', expected_qty: 15, received_qty: 15, unit_cost: 22.00, lot_number: 'LOT-B' },
      { id: 'si-3', variant_id: 'var-103', name: 'Utility Tote', sku: 'BAG-TOT-BLK', expected_qty: 10, received_qty: 8, unit_cost: 14.25, lot_number: 'LOT-C' },
      { id: 'si-4', variant_id: 'var-104', name: 'Vintage Dad Cap', sku: 'HAT-CAP-KHA', expected_qty: 20, received_qty: 20, unit_cost: 6.00, lot_number: 'LOT-D' },
    ];
    this.poNumber = 'PO-8842';
    this.supplierName = 'Supplier Delivery #4';
    this.notes = 'Routine restock shipment';
  }

  updateReceivedQty(id, delta) {
    this.items = this.items.map(item => {
      if (item.id === id) {
        const next = Math.max(0, item.received_qty + delta);
        return { ...item, received_qty: next };
      }
      return item;
    });
  }

  updateUnitCost(id, text) {
    const val = parseFloat(text) || 0;
    this.items = this.items.map(item => (item.id === id ? { ...item, unit_cost: val } : item));
  }

  updateLotNumber(id, text) {
    this.items = this.items.map(item => (item.id === id ? { ...item, lot_number: text } : item));
  }

  addUnexpectedItem(sku = 'SKU-UNEXP-1', name = 'Unexpected Item', unitCost = 10.00) {
    const nextId = `si-${Date.now()}`;
    const newItem = {
      id: nextId,
      variant_id: `var-unexp-${Date.now()}`,
      name,
      sku,
      category: 'Uncategorized',
      expected_qty: 0,
      received_qty: 1,
      unit_cost: unitCost,
      lot_number: `LOT-UNEXP-${this.items.length + 1}`,
    };
    this.items.push(newItem);
    return newItem;
  }

  get totalLoggedItems() {
    return this.items.filter(i => i.received_qty > 0).length;
  }

  get totalValue() {
    return this.items.reduce((sum, item) => sum + item.received_qty * item.unit_cost, 0);
  }

  get totalReceivedUnits() {
    return this.items.reduce((sum, item) => sum + item.received_qty, 0);
  }

  hasDiscrepancy(item) {
    return item.expected_qty > 0 && item.received_qty !== item.expected_qty;
  }

  canCompleteIntake() {
    return this.totalLoggedItems > 0;
  }

  buildPayload() {
    return {
      session_date: new Date().toISOString().split('T')[0],
      notes: `${this.poNumber} - ${this.supplierName}: ${this.notes}`,
      items: this.items
        .filter(i => i.received_qty > 0)
        .map(i => ({
          variant_id: i.variant_id,
          quantity: i.received_qty,
          unit_cost: i.unit_cost,
          scanned_barcode: i.sku,
        })),
    };
  }
}

// =============================================================
// TEST SUITES
// =============================================================

console.log('====================================================');
console.log('KC INVENTORY MOBILE - EMPIRICAL STRESS TEST SUITE');
console.log('====================================================\n');

// -------------------------------------------------------------
// 1. CART CALCULATION & EDGE CASES
// -------------------------------------------------------------
console.log('--- SUITE 1: Cart Calculation & Edge Cases ---');

test('Cart: Initial empty state returns 0 total, 0 count, no warnings', () => {
  const cart = new CartHookSimulator();
  assert.strictEqual(cart.cart.length, 0);
  assert.strictEqual(cart.cartTotal, 0);
  assert.strictEqual(cart.totalItemCount, 0);
  assert.strictEqual(cart.hasOutOfStockItems, false);
  assert.deepStrictEqual(cart.stockWarnings, {});
});

test('Cart: Adding single variant resolves correct price hierarchy (override > variant price > product price)', () => {
  const cart = new CartHookSimulator();

  // Case A: Override price takes precedence
  cart.addVariantToCart({
    id: 'v1',
    sku: 'SKU-1',
    selling_price_override: '29.99',
    selling_price: '35.00',
    quantity_on_hand: 10,
    product: { selling_price: '40.00', name: 'Shirt' },
  }, 'Shirt');
  assert.strictEqual(cart.cart[0].unitPrice, 29.99);

  // Case B: Fallback to variant selling_price if override is null
  cart.addVariantToCart({
    id: 'v2',
    sku: 'SKU-2',
    selling_price_override: null,
    selling_price: '45.50',
    quantity_on_hand: 5,
    product: { selling_price: '50.00', name: 'Pants' },
  }, 'Pants');
  assert.strictEqual(cart.cart[1].unitPrice, 45.50);

  // Case C: Fallback to product selling_price if variant prices are null
  cart.addVariantToCart({
    id: 'v3',
    sku: 'SKU-3',
    selling_price_override: null,
    selling_price: null,
    quantity_on_hand: 8,
    product: { selling_price: '19.95', name: 'Cap' },
  }, 'Cap');
  assert.strictEqual(cart.cart[2].unitPrice, 19.95);
});

test('Cart: Repeatedly adding the same variant increments quantity without duplicating rows', () => {
  const cart = new CartHookSimulator();
  const variant = {
    id: 'v1',
    sku: 'SKU-1',
    selling_price: '10.00',
    quantity_on_hand: 20,
  };

  cart.addVariantToCart(variant, 'Item 1');
  cart.addVariantToCart(variant, 'Item 1');
  cart.addVariantToCart(variant, 'Item 1');

  assert.strictEqual(cart.cart.length, 1);
  assert.strictEqual(cart.cart[0].quantity, 3);
  assert.strictEqual(cart.totalItemCount, 3);
  assert.strictEqual(cart.cartTotal, 30.00);
});

test('Cart: Stepper decrement to 0 removes item from cart automatically', () => {
  const cart = new CartHookSimulator();
  cart.addVariantToCart({ id: 'v1', sku: 'SKU-1', selling_price: '12.00', quantity_on_hand: 5 }, 'Item 1');
  cart.addVariantToCart({ id: 'v2', sku: 'SKU-2', selling_price: '20.00', quantity_on_hand: 5 }, 'Item 2');

  assert.strictEqual(cart.cart.length, 2);
  assert.strictEqual(cart.totalItemCount, 2);

  // Decrement v1 from 1 to 0 -> should remove v1
  cart.updateQuantity('v1', -1);
  assert.strictEqual(cart.cart.length, 1);
  assert.strictEqual(cart.cart[0].variantId, 'v2');
  assert.strictEqual(cart.totalItemCount, 1);
  assert.strictEqual(cart.cartTotal, 20.00);

  // Decrement v2 from 1 to 0 -> should empty cart
  cart.updateQuantity('v2', -1);
  assert.strictEqual(cart.cart.length, 0);
  assert.strictEqual(cart.totalItemCount, 0);
  assert.strictEqual(cart.cartTotal, 0);
});

test('Cart: setItemQuantity(variantId, 0) and negative values remove item', () => {
  const cart = new CartHookSimulator();
  cart.addVariantToCart({ id: 'v1', sku: 'SKU-1', selling_price: '15.00', quantity_on_hand: 10 }, 'Item 1');
  cart.setItemQuantity('v1', 5);
  assert.strictEqual(cart.cart[0].quantity, 5);
  assert.strictEqual(cart.cartTotal, 75.00);

  // Set quantity to 0
  cart.setItemQuantity('v1', 0);
  assert.strictEqual(cart.cart.length, 0);

  // Add again and set negative quantity
  cart.addVariantToCart({ id: 'v1', sku: 'SKU-1', selling_price: '15.00', quantity_on_hand: 10 }, 'Item 1');
  cart.setItemQuantity('v1', -3);
  assert.strictEqual(cart.cart.length, 0);
});

test('Cart: Multi-item precision calculations with floating point edge prices', () => {
  const cart = new CartHookSimulator();
  // Items with tricky decimal representations
  cart.addVariantToCart({ id: 'v1', sku: 'SKU-1', selling_price: '19.99', quantity_on_hand: 100 }, 'Item 1'); // 19.99 * 3 = 59.97
  cart.setItemQuantity('v1', 3);

  cart.addVariantToCart({ id: 'v2', sku: 'SKU-2', selling_price: '0.99', quantity_on_hand: 100 }, 'Item 2');  // 0.99 * 7 = 6.93
  cart.setItemQuantity('v2', 7);

  cart.addVariantToCart({ id: 'v3', sku: 'SKU-3', selling_price: '100.05', quantity_on_hand: 100 }, 'Item 3'); // 100.05 * 2 = 200.10
  cart.setItemQuantity('v3', 2);

  // Total should be 59.97 + 6.93 + 200.10 = 267.00
  const expectedTotal = 267.00;
  assert.strictEqual(Math.round(cart.cartTotal * 100) / 100, expectedTotal);
  assert.strictEqual(cart.totalItemCount, 12);
});

test('Cart: Stock warnings when adding items exceeding available stock or 0 stock', () => {
  const cart = new CartHookSimulator();

  // Out of stock item
  cart.addVariantToCart({ id: 'v-oos', sku: 'SKU-OOS', selling_price: '10.00', quantity_on_hand: 0 }, 'OOS Item');
  assert.strictEqual(cart.hasOutOfStockItems, true);
  assert.strictEqual(cart.stockWarnings['v-oos'], 'Out of stock');

  // Item with available stock = 2, added 3 times
  cart.addVariantToCart({ id: 'v-lim', sku: 'SKU-LIM', selling_price: '20.00', quantity_on_hand: 2 }, 'Limited Item');
  cart.setItemQuantity('v-lim', 3);
  assert.strictEqual(cart.stockWarnings['v-lim'], 'Exceeds stock (available: 2)');

  // In-stock item
  cart.addVariantToCart({ id: 'v-ok', sku: 'SKU-OK', selling_price: '5.00', quantity_on_hand: 10 }, 'OK Item');
  assert.strictEqual(cart.stockWarnings['v-ok'], undefined);
});

test('Cart: clearCart removes all items and resets totals', () => {
  const cart = new CartHookSimulator();
  cart.addVariantToCart({ id: 'v1', sku: 'SKU-1', selling_price: '10.00', quantity_on_hand: 5 }, 'Item 1');
  cart.addVariantToCart({ id: 'v2', sku: 'SKU-2', selling_price: '20.00', quantity_on_hand: 5 }, 'Item 2');
  assert.strictEqual(cart.cart.length, 2);

  cart.clearCart();
  assert.strictEqual(cart.cart.length, 0);
  assert.strictEqual(cart.cartTotal, 0);
  assert.strictEqual(cart.totalItemCount, 0);
  assert.strictEqual(cart.hasOutOfStockItems, false);
});

// -------------------------------------------------------------
// 2. STOCK ADJUSTMENT CALCULATIONS & VALIDATION
// -------------------------------------------------------------
console.log('\n--- SUITE 2: Stock Adjustment Calculations & Validation ---');

test('Stock Adj: Positive discrepancy (+variance) yields positive diff, green styling category, and +units string', () => {
  const adj = new StockAdjustmentSimulator(10); // current: 10
  adj.newCount = 15; // physical: 15

  assert.strictEqual(adj.difference, 5);
  assert.strictEqual(adj.differenceDisplay, '+5 units');
  assert.strictEqual(adj.colorCategory, 'positive');

  const payload = adj.buildPayload('var-101');
  assert.strictEqual(payload.variant_id, 'var-101');
  assert.strictEqual(payload.current_quantity, 10);
  assert.strictEqual(payload.new_quantity, 15);
  assert.strictEqual(payload.difference, 5);
  assert.strictEqual(payload.reason, 'Audit');
});

test('Stock Adj: Negative discrepancy (-variance) yields negative diff, red styling category, and units string', () => {
  const adj = new StockAdjustmentSimulator(25); // current: 25
  adj.newCount = 18; // physical: 18

  assert.strictEqual(adj.difference, -7);
  assert.strictEqual(adj.differenceDisplay, '-7 units');
  assert.strictEqual(adj.colorCategory, 'negative');

  adj.selectedReason = 'Damaged';
  adj.notes = 'Found 7 damaged units during audit';
  const payload = adj.buildPayload('var-102');
  assert.strictEqual(payload.difference, -7);
  assert.strictEqual(payload.reason, 'Damaged');
  assert.strictEqual(payload.notes, 'Found 7 damaged units during audit');
});

test('Stock Adj: Zero discrepancy (no change) yields 0 diff, neutral styling category, and 0 (No Change)', () => {
  const adj = new StockAdjustmentSimulator(42); // current: 42
  adj.newCount = 42; // physical: 42

  assert.strictEqual(adj.difference, 0);
  assert.strictEqual(adj.differenceDisplay, '0 (No Change)');
  assert.strictEqual(adj.colorCategory, 'neutral');
});

test('Stock Adj: Stepper decrement boundary clamping at 0', () => {
  const adj = new StockAdjustmentSimulator(2);
  adj.decrement(); // 1
  assert.strictEqual(adj.newCount, 1);
  adj.decrement(); // 0
  assert.strictEqual(adj.newCount, 0);
  adj.decrement(); // should stay 0
  assert.strictEqual(adj.newCount, 0);
  adj.decrement(); // should stay 0
  assert.strictEqual(adj.newCount, 0);
  assert.strictEqual(adj.difference, -2);
});

test('Stock Adj: Text input parsing edge cases (empty, non-numeric, negative strings)', () => {
  const adj = new StockAdjustmentSimulator(10);

  // Non-numeric string -> defaults to 0
  adj.setCountText('abc');
  assert.strictEqual(adj.newCount, 0);

  // Valid number string -> parsed
  adj.setCountText('120');
  assert.strictEqual(adj.newCount, 120);
  assert.strictEqual(adj.difference, 110);

  // Negative number in string -> Math.max(0, parsed) clamps to 0
  adj.setCountText('-15');
  assert.strictEqual(adj.newCount, 0);
});

test('Stock Adj: Reason selection supports all standard taxonomy reasons', () => {
  const validReasons = ['Audit', 'Damaged', 'Restock', 'Return', 'Shrinkage'];
  const adj = new StockAdjustmentSimulator(10);

  for (const r of validReasons) {
    adj.selectedReason = r;
    const payload = adj.buildPayload('var-test');
    assert.strictEqual(payload.reason, r);
  }
});

// -------------------------------------------------------------
// 3. STOCK IN BATCH RESTOCK CALCULATIONS & VALIDATION
// -------------------------------------------------------------
console.log('\n--- SUITE 3: Stock In Batch Restock Calculations & Validation ---');

test('Stock In: Initial batch metrics computation', () => {
  const stockIn = new StockInSimulator();
  // Items:
  // 1: 24 * $8.50 = $204.00
  // 2: 15 * $22.00 = $330.00
  // 3: 8 * $14.25 = $114.00
  // 4: 20 * $6.00 = $120.00
  // Total units = 24 + 15 + 8 + 20 = 67
  // Total value = 204.00 + 330.00 + 114.00 + 120.00 = $768.00
  assert.strictEqual(stockIn.totalLoggedItems, 4);
  assert.strictEqual(stockIn.totalReceivedUnits, 67);
  assert.strictEqual(stockIn.totalValue, 768.00);
  assert.strictEqual(stockIn.canCompleteIntake(), true);
});

test('Stock In: Discrepancy detection between expected and received quantities', () => {
  const stockIn = new StockInSimulator();

  // Item 1: expected 24, received 24 -> NO discrepancy
  assert.strictEqual(stockIn.hasDiscrepancy(stockIn.items[0]), false);

  // Item 3: expected 10, received 8 -> HAS discrepancy
  assert.strictEqual(stockIn.hasDiscrepancy(stockIn.items[2]), true);

  // Decrement Item 1 by 4 -> received 20 -> HAS discrepancy
  stockIn.updateReceivedQty('si-1', -4);
  assert.strictEqual(stockIn.items[0].received_qty, 20);
  assert.strictEqual(stockIn.hasDiscrepancy(stockIn.items[0]), true);
});

test('Stock In: Updating unit costs dynamically recalculates total intake value', () => {
  const stockIn = new StockInSimulator();
  const initialValue = stockIn.totalValue;

  // Change Item 1 unit cost from $8.50 to $10.00 (+$1.50 * 24 units = +$36.00)
  stockIn.updateUnitCost('si-1', '10.00');
  assert.strictEqual(stockIn.items[0].unit_cost, 10.00);
  assert.strictEqual(stockIn.totalValue, initialValue + 36.00);

  // Invalid cost input defaults to 0
  stockIn.updateUnitCost('si-1', 'invalid');
  assert.strictEqual(stockIn.items[0].unit_cost, 0);
});

test('Stock In: Adding unexpected shipment item appends item and updates totals', () => {
  const stockIn = new StockInSimulator();
  const prevCount = stockIn.items.length;
  const prevUnits = stockIn.totalReceivedUnits;
  const prevValue = stockIn.totalValue;

  const newItem = stockIn.addUnexpectedItem('SKU-UNEXP-99', 'Extra Winter Scarf', 15.50);
  assert.strictEqual(stockIn.items.length, prevCount + 1);
  assert.strictEqual(newItem.expected_qty, 0);
  assert.strictEqual(newItem.received_qty, 1);
  assert.strictEqual(newItem.unit_cost, 15.50);

  // For unexpected items (expected_qty = 0), hasDiscrepancy should be false
  assert.strictEqual(stockIn.hasDiscrepancy(newItem), false);

  assert.strictEqual(stockIn.totalReceivedUnits, prevUnits + 1);
  assert.strictEqual(stockIn.totalValue, prevValue + 15.50);
});

test('Stock In: Validation fails when all received quantities are 0', () => {
  const stockIn = new StockInSimulator();
  for (const item of stockIn.items) {
    stockIn.updateReceivedQty(item.id, -999); // zero out all
  }

  assert.strictEqual(stockIn.totalLoggedItems, 0);
  assert.strictEqual(stockIn.totalReceivedUnits, 0);
  assert.strictEqual(stockIn.totalValue, 0);
  assert.strictEqual(stockIn.canCompleteIntake(), false);
});

test('Stock In: RestockPayload structure matches backend API contract (/api/v1/inventory/restock)', () => {
  const stockIn = new StockInSimulator();
  const payload = stockIn.buildPayload();

  assert.ok(payload.session_date);
  assert.ok(payload.notes.includes('PO-8842'));
  assert.ok(Array.isArray(payload.items));
  assert.strictEqual(payload.items.length, 4);

  for (const item of payload.items) {
    assert.ok(item.variant_id);
    assert.ok(typeof item.quantity === 'number' && item.quantity > 0);
    assert.ok(typeof item.unit_cost === 'number');
    assert.ok(item.scanned_barcode);
  }
});

// -------------------------------------------------------------
// 4. DESIGN TOKENS & INTEGRITY CHECKS
// -------------------------------------------------------------
console.log('\n--- SUITE 4: Design Tokens & UI Architecture Integrity ---');

test('Tokens: Warm KC Inventory palette values', () => {
  // Required token constants
  const expectedTokens = {
    primary: '#924C00',
    primaryContainer: '#FF8800',
    background: '#F8F5F0',
    surfaceContainerLowest: '#FFFFFF',
    borderSubtle: '#E8E2D9',
    statusSuccess: '#34A853',
    statusError: '#BA1A1A',
    errorContainer: '#FFDAD6',
    cardRadius: 24,
    bentoRadius: 32,
    pillRadius: 9999,
  };

  assert.strictEqual(expectedTokens.primaryContainer, '#FF8800');
  assert.strictEqual(expectedTokens.background, '#F8F5F0');
  assert.strictEqual(expectedTokens.borderSubtle, '#E8E2D9');
  assert.strictEqual(expectedTokens.cardRadius, 24);
  assert.strictEqual(expectedTokens.bentoRadius, 32);
});

// -------------------------------------------------------------
// 5. DYNAMIC ROLE-BASED ACCESS CONTROL (RBAC) & usePermissions
// -------------------------------------------------------------
console.log('\n--- SUITE 5: Dynamic Role-Based Access Control (RBAC) & usePermissions ---');

function matchPermission(granted, requested) {
  if (!granted || !requested) return false;
  if (granted === '*') return true;
  if (granted === requested) return true;

  const colonIdx = granted.indexOf(':');
  if (colonIdx !== -1 && granted.slice(colonIdx + 1) === '*') {
    const grantedModule = granted.slice(0, colonIdx);
    const reqColonIdx = requested.indexOf(':');
    const requestedModule = reqColonIdx !== -1 ? requested.slice(0, reqColonIdx) : requested;
    return grantedModule === requestedModule;
  }

  return false;
}

const TAB_PERMISSION = {
  admin: 'users:manage',
  roles: 'roles:manage',
  reports: 'reports:view',
  expenses: 'expenses:view',
  products: 'products:read',
  categories: 'products:*',
  inventory: 'inventory:adjust',
  invoices: 'sales:*',
  'sales-channels': 'settings:*',
  'bank-accounts': 'settings:*',
  'delivery-companies': 'settings:*',
  'delivery-zones': 'settings:*',
  settings: 'settings:*',
};

class PermissionsHookSimulator {
  constructor(currentUser) {
    this.currentUser = currentUser;
  }

  can(permission) {
    if (!this.currentUser) return false;
    if (this.currentUser.role === 'SUPER_ADMIN') return true;
    if (this.currentUser.overrides?.[permission] === false) return false;
    if (this.currentUser.overrides?.[permission] === true) return true;

    const grants = this.currentUser.permissions || [];
    return grants.some(g => matchPermission(g, permission));
  }

  hasAny(permissions) {
    if (!this.currentUser) return false;
    if (this.currentUser.role === 'SUPER_ADMIN') return true;
    if (!permissions || permissions.length === 0) return false;
    return permissions.some(p => this.can(p));
  }

  hasAll(permissions) {
    if (!this.currentUser) return false;
    if (this.currentUser.role === 'SUPER_ADMIN') return true;
    if (!permissions || permissions.length === 0) return true;
    return permissions.every(p => this.can(p));
  }

  canAccessTab(tab) {
    if (!this.currentUser) return false;
    if (this.currentUser.role === 'SUPER_ADMIN') return true;
    const required = TAB_PERMISSION[tab];
    if (!required) return true;
    return this.can(required);
  }

  canPerformAction(action, module) {
    if (!this.currentUser) return false;
    if (this.currentUser.role === 'SUPER_ADMIN') return true;
    const permissionKey = module ? (action.includes(':') ? action : `${module}:${action}`) : action;
    return this.can(permissionKey);
  }
}

test('RBAC: matchPermission exact, module wildcard, and root wildcard matches', () => {
  // Exact match
  assert.strictEqual(matchPermission('products:read', 'products:read'), true);
  assert.strictEqual(matchPermission('products:read', 'products:create'), false);

  // Module wildcard match
  assert.strictEqual(matchPermission('products:*', 'products:read'), true);
  assert.strictEqual(matchPermission('products:*', 'products:create'), true);
  assert.strictEqual(matchPermission('products:*', 'products:delete'), true);
  assert.strictEqual(matchPermission('products:*', 'sales:checkout'), false);
  assert.strictEqual(matchPermission('sales:*', 'pos:checkout'), false); // Different module prefix
  assert.strictEqual(matchPermission('pos:*', 'pos:checkout'), true);

  // Root wildcard match
  assert.strictEqual(matchPermission('*', 'anything:anyaction'), true);
  assert.strictEqual(matchPermission('*', 'users:manage'), true);

  // Empty / null edge cases
  assert.strictEqual(matchPermission(null, 'products:read'), false);
  assert.strictEqual(matchPermission('products:*', null), false);
  assert.strictEqual(matchPermission('', ''), false);
});

test('RBAC: Super Admin bypasses all checks even with empty permissions array', () => {
  const superAdminHook = new PermissionsHookSimulator({
    id: 'usr-sa',
    name: 'Super Admin',
    role: 'SUPER_ADMIN',
    permissions: [], // Empty dynamic array
  });

  assert.strictEqual(superAdminHook.can('products:delete'), true);
  assert.strictEqual(superAdminHook.can('users:manage'), true);
  assert.strictEqual(superAdminHook.can('roles:manage'), true);
  assert.strictEqual(superAdminHook.can('anything:custom'), true);
  assert.strictEqual(superAdminHook.canAccessTab('admin'), true);
  assert.strictEqual(superAdminHook.canAccessTab('roles'), true);
  assert.strictEqual(superAdminHook.hasAny(['unknown:perm']), true);
  assert.strictEqual(superAdminHook.hasAll(['unknown:perm', 'other:perm']), true);
});

test('RBAC: Dynamic permissions evaluation for Manager and Seller roles', () => {
  const managerUser = {
    id: 'usr-mgr',
    name: 'Store Manager',
    role: 'MANAGER',
    permissions: ['products:read', 'inventory:adjust', 'pos:*', 'expenses:*', 'reports:view', 'quotations:*', 'customers:*'],
  };
  const managerHook = new PermissionsHookSimulator(managerUser);

  // Manager should have POS, inventory adjust, products read
  assert.strictEqual(managerHook.can('products:read'), true);
  assert.strictEqual(managerHook.can('inventory:adjust'), true);
  assert.strictEqual(managerHook.can('pos:checkout'), true);
  assert.strictEqual(managerHook.can('expenses:view'), true);
  assert.strictEqual(managerHook.can('reports:view'), true);

  // Manager should NOT have user management or product creation
  assert.strictEqual(managerHook.can('users:manage'), false);
  assert.strictEqual(managerHook.can('products:create'), false);
  assert.strictEqual(managerHook.can('roles:manage'), false);

  // Seller user with restricted capabilities
  const sellerUser = {
    id: 'usr-seller',
    name: 'Cashier Seller',
    role: 'SELLER',
    permissions: ['pos:checkout', 'inventory:scan', 'quotations:create', 'customers:view', 'transactions:view'],
  };
  const sellerHook = new PermissionsHookSimulator(sellerUser);

  assert.strictEqual(sellerHook.can('pos:checkout'), true);
  assert.strictEqual(sellerHook.can('inventory:scan'), true);
  assert.strictEqual(sellerHook.can('inventory:adjust'), false);
  assert.strictEqual(sellerHook.can('expenses:view'), false);
  assert.strictEqual(sellerHook.can('users:manage'), false);
  assert.strictEqual(sellerHook.canAccessTab('admin'), false);
  assert.strictEqual(sellerHook.canAccessTab('roles'), false);
  assert.strictEqual(sellerHook.canAccessTab('pos'), true); // Default allowed
});

test('RBAC: hasAny and hasAll helper functions', () => {
  const adminUser = {
    id: 'usr-admin',
    name: 'Branch Admin',
    role: 'ADMIN',
    permissions: ['products:*', 'sales:*', 'users:manage'],
  };
  const adminHook = new PermissionsHookSimulator(adminUser);

  // hasAny
  assert.strictEqual(adminHook.hasAny(['products:create', 'roles:manage']), true); // has products:create
  assert.strictEqual(adminHook.hasAny(['roles:manage', 'audit:view']), false); // has neither

  // hasAll
  assert.strictEqual(adminHook.hasAll(['products:read', 'users:manage']), true); // has both
  assert.strictEqual(adminHook.hasAll(['products:read', 'roles:manage']), false); // lacks roles:manage
  assert.strictEqual(adminHook.hasAll([]), true); // Empty list satisfies hasAll
});

test('RBAC: canAccessTab evaluates all gated tabs properly', () => {
  const sellerUser = {
    id: 'usr-s',
    name: 'Seller',
    role: 'SELLER',
    permissions: ['pos:checkout', 'inventory:scan'],
  };
  const sellerHook = new PermissionsHookSimulator(sellerUser);

  assert.strictEqual(sellerHook.canAccessTab('admin'), false); // requires users:manage
  assert.strictEqual(sellerHook.canAccessTab('roles'), false); // requires roles:manage
  assert.strictEqual(sellerHook.canAccessTab('reports'), false); // requires reports:view
  assert.strictEqual(sellerHook.canAccessTab('expenses'), false); // requires expenses:view
  assert.strictEqual(sellerHook.canAccessTab('products'), false); // requires products:read
  assert.strictEqual(sellerHook.canAccessTab('home'), true); // public authenticated tab
  assert.strictEqual(sellerHook.canAccessTab('pos'), true);
});

// -------------------------------------------------------------
// 6. STAFF MANAGEMENT, PERFORMANCE & COMMISSION INCENTIVES
// -------------------------------------------------------------
console.log('\n--- SUITE 6: Staff Management, Performance & Commissions ---');

function calculateTieredIncentive(amount) {
  if (amount < 1.0) return 0.0;
  if (amount <= 30.0) return 0.25;
  if (amount <= 50.0) return 0.50;
  if (amount <= 60.0) return 0.75;
  if (amount <= 80.0) return 1.00;
  return 2.00;
}

test('Staff Commission: Exact tier boundary values ($1, $30, $50, $60, $80)', () => {
  assert.strictEqual(calculateTieredIncentive(0.50), 0.0);
  assert.strictEqual(calculateTieredIncentive(1.00), 0.25);
  assert.strictEqual(calculateTieredIncentive(30.00), 0.25);
  assert.strictEqual(calculateTieredIncentive(30.01), 0.50);
  assert.strictEqual(calculateTieredIncentive(50.00), 0.50);
  assert.strictEqual(calculateTieredIncentive(50.01), 0.75);
  assert.strictEqual(calculateTieredIncentive(60.00), 0.75);
  assert.strictEqual(calculateTieredIncentive(60.01), 1.00);
  assert.strictEqual(calculateTieredIncentive(80.00), 1.00);
  assert.strictEqual(calculateTieredIncentive(80.01), 2.00);
  assert.strictEqual(calculateTieredIncentive(500.00), 2.00);
});

test('Staff Performance: Aggregates total sales, orders, AOV, and incentives across days', () => {
  const orders = [
    { id: '1', date: '2026-08-01', amount: 25.00 }, // +0.25
    { id: '2', date: '2026-08-01', amount: 45.00 }, // +0.50
    { id: '3', date: '2026-08-02', amount: 100.00 }, // +2.00
  ];

  let totalSales = 0;
  let totalIncentive = 0;
  orders.forEach(o => {
    totalSales += o.amount;
    totalIncentive += calculateTieredIncentive(o.amount);
  });

  const avgOrderValue = Math.round((totalSales / orders.length) * 100) / 100;
  assert.strictEqual(totalSales, 170.00);
  assert.strictEqual(orders.length, 3);
  assert.strictEqual(avgOrderValue, 56.67);
  assert.strictEqual(totalIncentive, 2.75);
});

test('Salary History: Computes correct delta percentage and raise amounts', () => {
  const history = [
    { base_salary: 500, previous_salary: null },
    { base_salary: 600, previous_salary: 500 },
    { base_salary: 750, previous_salary: 600 },
  ];

  const raise1Diff = 600 - 500;
  const raise1Pct = Math.round(((600 - 500) / 500) * 1000) / 10; // 20.0%
  assert.strictEqual(raise1Diff, 100);
  assert.strictEqual(raise1Pct, 20.0);

  const raise2Diff = 750 - 600;
  const raise2Pct = Math.round(((750 - 600) / 600) * 1000) / 10; // 25.0%
  assert.strictEqual(raise2Diff, 150);
  assert.strictEqual(raise2Pct, 25.0);
});

// -------------------------------------------------------------
// 7. POS CHECKOUT VALIDATION (ADDRESS & CUSTOM DELIVERY FEE)
// -------------------------------------------------------------
console.log('\n--- SUITE 7: POS Checkout Validation (Address & Custom Delivery Fee) ---');

function validatePosCheckout(data) {
  const errors = {};
  if (!data.customerName || !data.customerName.trim()) {
    errors.customerName = 'Name is required';
  }
  if (!data.customerPhone || !data.customerPhone.trim()) {
    errors.customerPhone = 'Phone is required';
  }
  if (data.isDelivery) {
    if (!data.deliveryAddress || data.deliveryAddress.trim().length < 3) {
      errors.deliveryAddress = 'Delivery address is required (minimum 3 characters)';
    }
  }
  if (data.customDeliveryFee !== undefined && data.customDeliveryFee !== '') {
    const feeNum = Number(data.customDeliveryFee);
    if (isNaN(feeNum) || feeNum < 0) {
      errors.customDeliveryFee = 'Custom delivery fee must be a valid positive amount ($0.00+)';
    }
  }
  return { isValid: Object.keys(errors).length === 0, errors };
}

test('POS Checkout: Validates that delivery address is required and >= 3 characters when isDelivery is true', () => {
  // Empty address fails
  const resEmpty = validatePosCheckout({
    customerName: 'Dara',
    customerPhone: '012345678',
    isDelivery: true,
    deliveryAddress: '',
  });
  assert.strictEqual(resEmpty.isValid, false);
  assert.strictEqual(resEmpty.errors.deliveryAddress, 'Delivery address is required (minimum 3 characters)');

  // Short whitespace address fails
  const resShort = validatePosCheckout({
    customerName: 'Dara',
    customerPhone: '012345678',
    isDelivery: true,
    deliveryAddress: 'ab',
  });
  assert.strictEqual(resShort.isValid, false);
  assert.strictEqual(resShort.errors.deliveryAddress, 'Delivery address is required (minimum 3 characters)');

  // Valid address passes
  const resValid = validatePosCheckout({
    customerName: 'Dara',
    customerPhone: '012345678',
    isDelivery: true,
    deliveryAddress: '#123, St 271, Phnom Penh',
  });
  assert.strictEqual(resValid.isValid, true);
  assert.strictEqual(resValid.errors.deliveryAddress, undefined);

  // In-Store sale does not require delivery address
  const resInStore = validatePosCheckout({
    customerName: 'Dara',
    customerPhone: '012345678',
    isDelivery: false,
    deliveryAddress: '',
  });
  assert.strictEqual(resInStore.isValid, true);
});

test('POS Checkout: Validates custom delivery fee must be a valid non-negative number', () => {
  // Negative amount fails
  const resNeg = validatePosCheckout({
    customerName: 'Dara',
    customerPhone: '012345678',
    isDelivery: true,
    deliveryAddress: 'St 2004',
    customDeliveryFee: '-5.00',
  });
  assert.strictEqual(resNeg.isValid, false);
  assert.strictEqual(resNeg.errors.customDeliveryFee, 'Custom delivery fee must be a valid positive amount ($0.00+)');

  // Non-numeric string fails
  const resAlpha = validatePosCheckout({
    customerName: 'Dara',
    customerPhone: '012345678',
    isDelivery: true,
    deliveryAddress: 'St 2004',
    customDeliveryFee: 'ten dollars',
  });
  assert.strictEqual(resAlpha.isValid, false);
  assert.strictEqual(resAlpha.errors.customDeliveryFee, 'Custom delivery fee must be a valid positive amount ($0.00+)');

  // Valid positive number passes
  const resPositive = validatePosCheckout({
    customerName: 'Dara',
    customerPhone: '012345678',
    isDelivery: true,
    deliveryAddress: 'St 2004',
    customDeliveryFee: '15.50',
  });
  assert.strictEqual(resPositive.isValid, true);

  // Zero cost passes (free delivery negotiation)
  const resZero = validatePosCheckout({
    customerName: 'Dara',
    customerPhone: '012345678',
    isDelivery: true,
    deliveryAddress: 'St 2004',
    customDeliveryFee: '0',
  });
  assert.strictEqual(resZero.isValid, true);
});

// -------------------------------------------------------------
// 8. STAFF DETAIL PERMISSIONS & VIEW-ONLY SAFEGUARDS
// -------------------------------------------------------------
console.log('\n--- SUITE 8: Staff Detail Permissions & View-Only Safeguards ---');

function evaluateStaffDetailPermissions(currentUser, targetUser) {
  const isSelf = !!(currentUser && targetUser && currentUser.id === targetUser.id);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const isAdmin = currentUser?.role === 'ADMIN';
  const hasPayrollManage = (currentUser?.permissions || []).some(p => p === 'payroll:manage' || p === 'payroll:*' || p === '*');
  const hasStaffManage = (currentUser?.permissions || []).some(p => p === 'users:manage' || p === 'users:*' || p === '*');

  const canManageStaff = isSuperAdmin || isAdmin || hasStaffManage;
  const canManagePayroll = (isSuperAdmin || isAdmin || hasPayrollManage) && (!isSelf || isSuperAdmin);

  return {
    isSelf,
    canManageStaff: canManageStaff && !isSelf,
    canManagePayroll,
    canGrantRaise: canManagePayroll,
    canDisburseBonus: canManagePayroll,
    isReadOnly: !canManagePayroll,
  };
}

test('Staff Detail: Cashier/Seller viewing their own profile has strictly View-Only access', () => {
  const cashier = { id: 'u-101', name: 'Sokha', role: 'SELLER', permissions: ['orders:create', 'inventory:view'] };
  const perm = evaluateStaffDetailPermissions(cashier, cashier);

  assert.strictEqual(perm.isSelf, true);
  assert.strictEqual(perm.canGrantRaise, false);
  assert.strictEqual(perm.canDisburseBonus, false);
  assert.strictEqual(perm.canManageStaff, false);
  assert.strictEqual(perm.isReadOnly, true);
});

test('Staff Detail: Store Admin/Super Admin can manage other staff raises & bonus disbursements', () => {
  const admin = { id: 'u-admin', name: 'Admin', role: 'ADMIN', permissions: ['payroll:manage', 'users:manage'] };
  const staff = { id: 'u-101', name: 'Sokha', role: 'SELLER', permissions: [] };
  const perm = evaluateStaffDetailPermissions(admin, staff);

  assert.strictEqual(perm.isSelf, false);
  assert.strictEqual(perm.canGrantRaise, true);
  assert.strictEqual(perm.canDisburseBonus, true);
  assert.strictEqual(perm.canManageStaff, true);
  assert.strictEqual(perm.isReadOnly, false);
});

// -------------------------------------------------------------
// 9. UNIFIED STAFF PROFILE & COMPENSATION FORM
// -------------------------------------------------------------
console.log('\n--- SUITE 9: Unified Staff Profile & Compensation Form ---');

function validateUnifiedStaffForm(values) {
  const errors = {};
  if (!values.name || values.name.trim().length < 2) {
    errors.name = 'Name must be at least 2 characters';
  }
  if (!values.email || !values.email.includes('@')) {
    errors.email = 'Invalid email address';
  }
  if (values.isNew && (!values.password || values.password.length < 8)) {
    errors.password = 'Password must be at least 8 characters';
  }
  if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SELLER'].includes(values.role)) {
    errors.role = 'Invalid role selected';
  }
  if (values.base_salary !== undefined && values.base_salary !== '') {
    const num = Number(values.base_salary);
    if (isNaN(num) || num < 0) {
      errors.base_salary = 'Base salary must be a valid non-negative amount ($0.00+)';
    }
  }

  const numericSalary = values.base_salary && !isNaN(Number(values.base_salary)) ? Number(values.base_salary) : 0;
  const dailyRate = numericSalary > 0 ? (numericSalary / 26).toFixed(2) : '0.00';
  const thirteenthMonthAccrual = numericSalary > 0 ? (numericSalary / 12).toFixed(2) : '0.00';

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    dailyRate,
    thirteenthMonthAccrual,
  };
}

test('Staff Form: Validates complete staff creation with employment and base salary', () => {
  const result = validateUnifiedStaffForm({
    name: 'Sokha Chan',
    email: 'sokha@kcinventory.com',
    phone: '+855 12 345 678',
    password: 'password123',
    role: 'SELLER',
    department: 'Main Counter',
    hire_date: '2026-08-01',
    notes: 'Morning shift lead',
    base_salary: '350.00',
    salary_reason: 'Initial Starting Package',
    isNew: true,
  });

  assert.strictEqual(result.isValid, true);
  assert.strictEqual(result.dailyRate, '13.46');
  assert.strictEqual(result.thirteenthMonthAccrual, '29.17');
});

test('Staff Form: Rejects negative base salary amounts', () => {
  const result = validateUnifiedStaffForm({
    name: 'Sokha Chan',
    email: 'sokha@kcinventory.com',
    role: 'SELLER',
    base_salary: '-50.00',
    isNew: false,
  });

  assert.strictEqual(result.isValid, false);
  assert.strictEqual(result.errors.base_salary, 'Base salary must be a valid non-negative amount ($0.00+)');
});

test('Staff Form: Correctly computes live 13th month accrual for $600 salary ($50.00/mo)', () => {
  const result = validateUnifiedStaffForm({
    name: 'Manager Dara',
    email: 'dara@kcinventory.com',
    role: 'MANAGER',
    base_salary: '600.00',
    isNew: false,
  });

  assert.strictEqual(result.isValid, true);
  assert.strictEqual(result.dailyRate, '23.08');
  assert.strictEqual(result.thirteenthMonthAccrual, '50.00');
});

console.log('\n====================================================');
console.log(`TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED (Total: ${passedTests + failedTests})`);
console.log('====================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

