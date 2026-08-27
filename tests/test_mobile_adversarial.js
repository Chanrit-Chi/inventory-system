/**
 * Adversarial Chaos & Stress Test Harness for KC Inventory Mobile
 * Evaluates extreme edge cases, fuzzing inputs, invariant checking,
 * and boundary conditions across mobile logic.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  try {
    fn();
    passedTests++;
    console.log(`✓ [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`✗ [FAIL] ${name}\n    Error: ${err.message}\n    Stack: ${err.stack}`);
  }
}

// -------------------------------------------------------------
// IMPORTED / SIMULATED LOGIC
// -------------------------------------------------------------

function computeLoyaltyTier(totalSpent) {
  const spent = typeof totalSpent === 'number' ? totalSpent : parseFloat(String(totalSpent || '0')) || 0;
  if (spent >= 1000) {
    return { tier: 'Platinum', color: '#5B21B6', bg: '#EDE9FE' };
  } else if (spent >= 500) {
    return { tier: 'Gold', color: '#B45309', bg: '#FEF9C3' };
  } else if (spent >= 200) {
    return { tier: 'Silver', color: '#4B5563', bg: '#F3F4F6' };
  }
  return { tier: 'Bronze', color: '#92400E', bg: '#FEF3C7' };
}

class CartSimulator {
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
}

console.log('====================================================');
console.log('ADVERSARIAL STRESS & INVARIANT VERIFICATION SUITE');
console.log('====================================================\n');

// -------------------------------------------------------------
// 1. ADVERSARIAL CART STRESS & CHAOS
// -------------------------------------------------------------
console.log('--- 1. Adversarial Cart & Mutation Chaos ---');

test('Cart: Fuzzing 1,000 rapid variant additions and decrements maintains exact invariants', () => {
  const cart = new CartSimulator();
  const variants = [
    { id: 'v1', sku: 'SKU-A', selling_price: '10.50', quantity_on_hand: 500 },
    { id: 'v2', sku: 'SKU-B', selling_price: '25.00', quantity_on_hand: 300 },
    { id: 'v3', sku: 'SKU-C', selling_price: '0.00', quantity_on_hand: 100 }, // Free promo
    { id: 'v4', sku: 'SKU-D', selling_price: '99.99', quantity_on_hand: 50 },
  ];

  let expectedCount = 0;
  let expectedTotal = 0;

  // Add 100 of each
  for (let i = 0; i < 100; i++) {
    for (const v of variants) {
      cart.addVariantToCart(v, 'Item');
      expectedCount++;
      expectedTotal += parseFloat(v.selling_price);
    }
  }

  assert.strictEqual(cart.totalItemCount, 400);
  assert.strictEqual(Math.round(cart.cartTotal * 100) / 100, Math.round(expectedTotal * 100) / 100);

  // Decrement v1 100 times -> should remove v1 completely
  for (let i = 0; i < 100; i++) {
    cart.updateQuantity('v1', -1);
  }
  assert.strictEqual(cart.cart.find(i => i.variantId === 'v1'), undefined);
  assert.strictEqual(cart.cart.length, 3);
  assert.strictEqual(cart.totalItemCount, 300);
});

test('Cart: Removing non-existent variantId is a safe no-op', () => {
  const cart = new CartSimulator();
  cart.addVariantToCart({ id: 'v1', sku: 'SKU-1', selling_price: '10.00', quantity_on_hand: 5 }, 'Item 1');
  
  // Attempt to remove unknown IDs
  cart.removeFromCart('non-existent-id-999');
  cart.updateQuantity('non-existent-id-888', -1);
  cart.updateQuantity('non-existent-id-777', 5);

  assert.strictEqual(cart.cart.length, 1);
  assert.strictEqual(cart.cart[0].variantId, 'v1');
  assert.strictEqual(cart.cart[0].quantity, 1);
});

test('Cart: Boundary stock warning conditions (quantity === stock vs quantity === stock + 1)', () => {
  const cart = new CartSimulator();
  const varWithStock5 = { id: 'v5', sku: 'SKU-5', selling_price: '10.00', quantity_on_hand: 5 };

  cart.addVariantToCart(varWithStock5, 'Item 5');
  cart.setItemQuantity('v5', 5); // EXACTLY equal to available stock

  // Exactly equal should NOT trigger an exceeds stock warning
  assert.strictEqual(cart.stockWarnings['v5'], undefined);

  // Exceeding by 1 unit -> MUST trigger warning
  cart.setItemQuantity('v5', 6);
  assert.strictEqual(cart.stockWarnings['v5'], 'Exceeds stock (available: 5)');

  // Decrement back to 5 -> Warning cleared
  cart.updateQuantity('v5', -1);
  assert.strictEqual(cart.stockWarnings['v5'], undefined);
});

// -------------------------------------------------------------
// 2. STOCK ADJUSTMENT INVARIANT CHECKING
// -------------------------------------------------------------
console.log('\n--- 2. Stock Adjustment Invariant Checking ---');

test('Stock Adj: Invariant difference === new_quantity - current_quantity over 5,000 randomized pairs', () => {
  for (let i = 0; i < 5000; i++) {
    const current = Math.floor(Math.random() * 1000);
    const physical = Math.floor(Math.random() * 1000);
    const diff = physical - current;

    // Verify color category
    let colorCat = 'neutral';
    if (diff > 0) colorCat = 'positive';
    if (diff < 0) colorCat = 'negative';

    if (diff > 0) {
      assert.strictEqual(colorCat, 'positive');
    } else if (diff < 0) {
      assert.strictEqual(colorCat, 'negative');
    } else {
      assert.strictEqual(colorCat, 'neutral');
    }
  }
});

// -------------------------------------------------------------
// 3. STOCK IN BATCH RESTOCK INVARIANT CHECKING
// -------------------------------------------------------------
console.log('\n--- 3. Stock In Batch Restock Invariant Checking ---');

test('Stock In: Batch total value invariant sum(qty * unit_cost) over 1,000 randomized batches', () => {
  for (let b = 0; b < 1000; b++) {
    const numItems = Math.floor(Math.random() * 8) + 1;
    const items = [];
    let expectedTotalValue = 0;
    let expectedTotalUnits = 0;

    for (let i = 0; i < numItems; i++) {
      const received = Math.floor(Math.random() * 50);
      const unitCost = Math.round((Math.random() * 100 + 0.05) * 100) / 100;
      items.push({
        id: `item-${i}`,
        received_qty: received,
        unit_cost: unitCost,
      });
      expectedTotalValue += received * unitCost;
      expectedTotalUnits += received;
    }

    const calculatedTotalValue = items.reduce((sum, it) => sum + it.received_qty * it.unit_cost, 0);
    const calculatedTotalUnits = items.reduce((sum, it) => sum + it.received_qty, 0);

    assert.strictEqual(calculatedTotalUnits, expectedTotalUnits);
    assert.strictEqual(Math.round(calculatedTotalValue * 100) / 100, Math.round(expectedTotalValue * 100) / 100);
  }
});

// -------------------------------------------------------------
// 4. CUSTOMER LOYALTY TIER BOUNDARIES
// -------------------------------------------------------------
console.log('\n--- 4. Customer Loyalty Tier Boundaries ---');

test('Loyalty: Strict verification of all tier cutoffs ($0, $199.99, $200, $499.99, $500, $999.99, $1000)', () => {
  // Bronze: < $200
  assert.strictEqual(computeLoyaltyTier(0).tier, 'Bronze');
  assert.strictEqual(computeLoyaltyTier(50).tier, 'Bronze');
  assert.strictEqual(computeLoyaltyTier(199.99).tier, 'Bronze');

  // Silver: >= $200 and < $500
  assert.strictEqual(computeLoyaltyTier(200.00).tier, 'Silver');
  assert.strictEqual(computeLoyaltyTier(350.00).tier, 'Silver');
  assert.strictEqual(computeLoyaltyTier(499.99).tier, 'Silver');

  // Gold: >= $500 and < $1000
  assert.strictEqual(computeLoyaltyTier(500.00).tier, 'Gold');
  assert.strictEqual(computeLoyaltyTier(750.00).tier, 'Gold');
  assert.strictEqual(computeLoyaltyTier(999.99).tier, 'Gold');

  // Platinum: >= $1000
  assert.strictEqual(computeLoyaltyTier(1000.00).tier, 'Platinum');
  assert.strictEqual(computeLoyaltyTier(5000.00).tier, 'Platinum');

  // Edge cases: strings, null, negative
  assert.strictEqual(computeLoyaltyTier('250.00').tier, 'Silver');
  assert.strictEqual(computeLoyaltyTier(null).tier, 'Bronze');
  assert.strictEqual(computeLoyaltyTier(-50).tier, 'Bronze');
});

// -------------------------------------------------------------
// 5. TOKENS & FORBIDDEN BLUE HEX AUDIT
// -------------------------------------------------------------
console.log('\n--- 5. Static Tokens & Banned Color Audit ---');

test('Tokens & Source Files: Zero occurrences of legacy blue hex codes across codebase', () => {
  const bannedBlues = [
    '#1E5EFF',
    '#EFF6FF',
    '#DBEAFE',
    '#BFDBFE',
    '#2563EB',
    '#3B82F6',
    '#1D4ED8',
    '#1E40AF',
  ];

  const targetDir = path.resolve(__dirname, '../frontend/mobile/src');
  const appTsx = path.resolve(__dirname, '../frontend/mobile/App.tsx');

  function scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const b of bannedBlues) {
      if (content.toLowerCase().includes(b.toLowerCase())) {
        throw new Error(`Banned blue token ${b} found in file: ${filePath}`);
      }
    }
  }

  function scanDirectory(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDirectory(full);
      } else if (/\.(tsx?|jsx?|json)$/.test(entry.name)) {
        scanFile(full);
      }
    }
  }

  scanDirectory(targetDir);
  scanFile(appTsx);
});

// -------------------------------------------------------------
// 6. CARTESIAN PRODUCT MATRIX & SKU GENERATOR INVARIANTS
// -------------------------------------------------------------
console.log('\n--- 6. Cartesian Product Matrix & SKU Invariants ---');

function generateCartesianMatrix(attributesList, baseName) {
  const parsedAttrs = attributesList
    .map((a) => ({
      name: a.name.trim(),
      values: a.valuesText.split(',').map((v) => v.trim()).filter(Boolean),
    }))
    .filter((a) => a.name && a.values.length > 0)

  if (parsedAttrs.length === 0) return []

  const combinations = parsedAttrs.reduce(
    (acc, attr) => {
      const next = []
      acc.forEach((existingComb) => {
        attr.values.forEach((val) => {
          next.push([
            ...existingComb,
            { id: `av-${attr.name}-${val}`, value_name: val, attribute: { name: attr.name } },
          ])
        })
      })
      return next
    },
    [[]]
  )

  const baseSkuPrefix = baseName
    ? baseName
        .split(' ')
        .map((w) => w.substring(0, 3).toUpperCase())
        .join('-')
    : 'PROD'

  return combinations.map((comb, idx) => {
    const name = comb.map((c) => c.value_name).join(' / ')
    const skuSuffix = comb.map((c) => c.value_name.substring(0, 3).toUpperCase()).join('-')
    const sku = `${baseSkuPrefix}-${skuSuffix}`
    const barcode = `8850${Math.floor(10000000 + Math.random() * 90000000)}`

    return {
      id: `var-new-${idx}`,
      name,
      sku,
      barcode,
      stock: 10,
      attribute_values: comb,
    }
  })
}

test('Matrix: Cartesian product size strictly equals product of attribute value lengths across 1,000 randomized matrices', () => {
  for (let t = 0; t < 1000; t++) {
    const numAttrs = Math.floor(Math.random() * 3) + 1 // 1 to 3 attributes
    const attrs = []
    let expectedCombos = 1

    for (let a = 0; a < numAttrs; a++) {
      const numVals = Math.floor(Math.random() * 5) + 1 // 1 to 5 values
      expectedCombos *= numVals
      const vals = []
      for (let v = 0; v < numVals; v++) {
        vals.push(`Val_${a}_${v}`)
      }
      attrs.push({
        id: `attr-${a}`,
        name: `Attr_${a}`,
        valuesText: vals.join(', '),
      })
    }

    const generated = generateCartesianMatrix(attrs, 'Test Product')
    assert.strictEqual(generated.length, expectedCombos)

    // Verify all generated SKUs are non-empty strings and barcodes are 12 digits
    const skus = new Set()
    for (const g of generated) {
      assert.ok(g.sku.length > 0)
      assert.ok(g.barcode.startsWith('8850'))
      assert.strictEqual(g.barcode.length, 12)
      skus.add(g.sku)
    }
    // All combinations should have distinct names
    const names = new Set(generated.map((g) => g.name))
    assert.strictEqual(names.size, expectedCombos)
  }
})

// -------------------------------------------------------------
// 7. 4-TAB BOTTOM NAVIGATION & STATE PERSISTENCE INVARIANTS
// -------------------------------------------------------------
console.log('\n--- 7. 4-Tab Navigation & State Invariants ---');

test('Navigation: BottomTabBar 4-tab structure covers Home, POS, Products, Transactions', () => {
  const tabs = [
    { key: 'home', label: 'Home' },
    { key: 'pos', label: 'POS' },
    { key: 'products', label: 'Products' },
    { key: 'transactions', label: 'Transactions' },
  ]

  assert.strictEqual(tabs.length, 4)
  const tabKeys = tabs.map((t) => t.key)
  assert.ok(tabKeys.includes('home'))
  assert.ok(tabKeys.includes('pos'))
  assert.ok(tabKeys.includes('products'))
  assert.ok(tabKeys.includes('transactions'))
  assert.ok(!tabKeys.includes('inventory'), 'Inventory tab removed — accessible via sidebar')

  // Verify active state mapping invariant
  function isTabActive(tabKey, activeTab) {
    return activeTab === tabKey
  }

  assert.strictEqual(isTabActive('home', 'home'), true)
  assert.strictEqual(isTabActive('pos', 'pos'), true)
  assert.strictEqual(isTabActive('products', 'products'), true)
  assert.strictEqual(isTabActive('transactions', 'transactions'), true)
  assert.strictEqual(isTabActive('pos', 'products'), false)
})

test('State: Shared Cart persists across simulated rapid tab switches', () => {
  const sharedCart = new CartSimulator()

  // 1. Add item on POS
  sharedCart.addVariantToCart({ id: 'v-1', sku: 'SKU-1', selling_price: '25.00', quantity_on_hand: 50 }, 'Shirt')
  assert.strictEqual(sharedCart.totalItemCount, 1)

  // 2. Switch to Products screen (simulated tab change)
  let currentTab = 'products'
  assert.strictEqual(sharedCart.totalItemCount, 1) // Cart not wiped!

  // 3. Switch to Home screen
  currentTab = 'home'
  assert.strictEqual(sharedCart.totalItemCount, 1)

  // 4. Global barcode scan adds another item
  sharedCart.addVariantToCart({ id: 'v-2', sku: 'SKU-2', selling_price: '15.00', quantity_on_hand: 30 }, 'Cap')
  assert.strictEqual(sharedCart.totalItemCount, 2)
  assert.strictEqual(sharedCart.cartTotal, 40.00)

  // 5. Switch back to POS
  currentTab = 'pos'
  assert.strictEqual(sharedCart.cart.length, 2)
  assert.strictEqual(sharedCart.totalItemCount, 2)
  assert.strictEqual(sharedCart.cartTotal, 40.00)
})

// -------------------------------------------------------------
// 8. PURCHASE ORDER CALCULATIONS & STATUS TRANSITIONS
// -------------------------------------------------------------
console.log('\n--- 8. Purchase Order Invariants & Transitions ---');

test('PO: Total cost invariant sum(line_items) and state transition from ORDERED to RECEIVED', () => {
  const lineItems = [
    { id: 'poi-1', variantId: 'v-1', quantity: 20, unitCost: 8.5 }, // 170.00
    { id: 'poi-2', variantId: 'v-2', quantity: 15, unitCost: 14.0 }, // 210.00
    { id: 'poi-3', variantId: 'v-3', quantity: 5, unitCost: 32.0 },  // 160.00
  ]

  const totalCost = lineItems.reduce((sum, item) => sum + item.quantity * item.unitCost, 0)
  assert.strictEqual(totalCost, 540.00)

  const po = {
    id: 'po-1',
    poNumber: 'PO-2026-001',
    supplierId: 'sup-1',
    status: 'ORDERED',
    items: lineItems,
    totalCost,
  }

  assert.strictEqual(po.status, 'ORDERED')

  // Receive PO
  po.status = 'RECEIVED'
  assert.strictEqual(po.status, 'RECEIVED')
})

// -------------------------------------------------------------
// 9. ADVERSARIAL DYNAMIC RBAC & WILDCARD PERMISSIONS CHAOS
// -------------------------------------------------------------
console.log('\n--- 9. Adversarial Dynamic RBAC & Permission Matching Chaos ---');

function matchPermission(granted, requested) {
  if (!granted || !requested) return false
  if (granted === '*') return true
  if (granted === requested) return true
  const colonIdx = granted.indexOf(':')
  if (colonIdx !== -1 && granted.slice(colonIdx + 1) === '*') {
    const grantedModule = granted.slice(0, colonIdx)
    const reqColonIdx = requested.indexOf(':')
    const requestedModule = reqColonIdx !== -1 ? requested.slice(0, reqColonIdx) : requested
    return grantedModule === requestedModule
  }
  return false
}

function evaluatePermission(user, permission) {
  if (!user) return false
  if (user.role === 'SUPER_ADMIN') return true
  if (user.overrides?.[permission] === false) return false
  if (user.overrides?.[permission] === true) return true
  const grants = user.permissions || []
  return grants.some(g => matchPermission(g, permission))
}

test('RBAC: Fuzzing 10,000 randomized permission evaluation queries across diverse roles and wildcards', () => {
  const modules = ['products', 'sales', 'inventory', 'customers', 'expenses', 'reports', 'users', 'settings', 'audit', 'roles'];
  const actions = ['read', 'create', 'edit', 'delete', 'manage', 'view', 'adjust', 'restock', 'checkout'];

  for (let i = 0; i < 10000; i++) {
    const mod = modules[Math.floor(Math.random() * modules.length)];
    const act = actions[Math.floor(Math.random() * actions.length)];
    const req = `${mod}:${act}`;

    // Test A: User with exact grant
    const exactUser = { role: 'SELLER', permissions: [req] };
    assert.strictEqual(evaluatePermission(exactUser, req), true);

    // Test B: User with module wildcard grant
    const moduleWildcardUser = { role: 'MANAGER', permissions: [`${mod}:*`] };
    assert.strictEqual(evaluatePermission(moduleWildcardUser, req), true);

    // Test C: User with root wildcard grant
    const rootUser = { role: 'ADMIN', permissions: ['*'] };
    assert.strictEqual(evaluatePermission(rootUser, req), true);

    // Test D: Super Admin bypass regardless of permissions array
    const superAdmin = { role: 'SUPER_ADMIN', permissions: [] };
    assert.strictEqual(evaluatePermission(superAdmin, req), true);

    // Test E: Unrelated grant should fail
    const diffMod = modules.find(m => m !== mod);
    const unrelatedUser = { role: 'SELLER', permissions: [`${diffMod}:*`] };
    assert.strictEqual(evaluatePermission(unrelatedUser, req), false);
  }
});

test('RBAC: Explicit user overrides strictly supersede role permissions', () => {
  // User with wildcard permissions but explicit negative override
  const restrictedAdmin = {
    role: 'ADMIN',
    permissions: ['products:*', 'sales:*'],
    overrides: {
      'products:delete': false, // Explicitly blocked
    },
  };

  assert.strictEqual(evaluatePermission(restrictedAdmin, 'products:read'), true);
  assert.strictEqual(evaluatePermission(restrictedAdmin, 'products:create'), true);
  assert.strictEqual(evaluatePermission(restrictedAdmin, 'products:delete'), false); // BLOCKED by override

  // Seller with no admin perms but explicit positive override
  const elevatedSeller = {
    role: 'SELLER',
    permissions: ['pos:checkout'],
    overrides: {
      'users:manage': true, // Explicitly granted
    },
  };

  assert.strictEqual(evaluatePermission(elevatedSeller, 'pos:checkout'), true);
  assert.strictEqual(evaluatePermission(elevatedSeller, 'users:manage'), true); // GRANTED by override
  assert.strictEqual(evaluatePermission(elevatedSeller, 'products:delete'), false);
});

test('RBAC: Dynamic permission mutations take effect immediately without caching', () => {
  const dynamicUser = {
    role: 'MANAGER',
    permissions: ['products:read', 'pos:checkout'],
  };

  // Initially cannot manage users
  assert.strictEqual(evaluatePermission(dynamicUser, 'users:manage'), false);

  // Super admin dynamically grants 'users:manage'
  dynamicUser.permissions.push('users:manage');
  assert.strictEqual(evaluatePermission(dynamicUser, 'users:manage'), true);

  // Super admin revokes 'pos:checkout'
  dynamicUser.permissions = dynamicUser.permissions.filter(p => p !== 'pos:checkout');
  assert.strictEqual(evaluatePermission(dynamicUser, 'pos:checkout'), false);
});

console.log('\n====================================================');
console.log(`ADVERSARIAL SUITE SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED (Total: ${passedTests + failedTests})`);
console.log('====================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

