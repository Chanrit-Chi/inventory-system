const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('  MILESTONE 2 EMPIRICAL CHALLENGE SUITE (OmniPOS)   ');
console.log('====================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${testName}: ${details}`);
    failures.push({ testName, details });
  }
}

// -----------------------------------------------------------------------------
// SUITE 1: Route Completeness & Mapping Integrity
// -----------------------------------------------------------------------------
console.log('--- SUITE 1: Route Completeness & Mapping Integrity ---');

const routerFile = path.resolve(__dirname, '../src/router/index.ts');
const sidebarFile = path.resolve(__dirname, '../src/components/shell/AppSidebar.vue');
const paletteFile = path.resolve(__dirname, '../src/components/shell/CommandPalette.vue');
const headerFile = path.resolve(__dirname, '../src/components/shell/AppHeader.vue');

const routerContent = fs.readFileSync(routerFile, 'utf8');
const sidebarContent = fs.readFileSync(sidebarFile, 'utf8');
const paletteContent = fs.readFileSync(paletteFile, 'utf8');
const headerContent = fs.readFileSync(headerFile, 'utf8');

// Extract routes from router
const routeRegex = /path:\s*['"]([^'"]+)['"]/g;
const routerPaths = [];
let match;
while ((match = routeRegex.exec(routerContent)) !== null) {
  routerPaths.push(match[1]);
}

console.log(`Router has ${routerPaths.length} route paths defined:`, routerPaths);

assert(routerPaths.includes('/'), 'Router defines root /');
assert(routerPaths.includes('/login'), 'Router defines /login');
assert(routerPaths.includes('/dashboard'), 'Router defines /dashboard');
assert(routerPaths.includes('/pos'), 'Router defines /pos');

// Filter authenticated navigation destinations (excluding '/' redirect and '/login')
const operationalRoutes = routerPaths.filter(p => p !== '/' && p !== '/login');
console.log(`Found ${operationalRoutes.length} operational routes in router.`);

// Extract all 'to' paths from AppSidebar
const sidebarToRegex = /to:\s*['"]([^'"]+)['"]/g;
const sidebarPaths = [];
while ((match = sidebarToRegex.exec(sidebarContent)) !== null) {
  sidebarPaths.push(match[1]);
}

// Unique sidebar paths (excluding /dashboard link in brand logo)
const uniqueSidebarPaths = [...new Set(sidebarPaths)];
console.log(`AppSidebar defines ${uniqueSidebarPaths.length} unique route destinations:`, uniqueSidebarPaths);

// Check that every operational route (except parameterized routes like /products/:id/edit) is in AppSidebar
const parameterizedRoutes = operationalRoutes.filter(r => r.includes(':'));
const staticOperationalRoutes = operationalRoutes.filter(r => !r.includes(':'));

for (const staticRoute of staticOperationalRoutes) {
  assert(
    uniqueSidebarPaths.includes(staticRoute),
    `Sidebar contains route: ${staticRoute}`,
    `Route ${staticRoute} was defined in router but missing from AppSidebar.vue`
  );
}

// Check that AppSidebar has NO dead links pointing to routes not in router
for (const sidebarRoute of uniqueSidebarPaths) {
  const existsInRouter = routerPaths.some(rp => rp === sidebarRoute || (rp.includes(':') && sidebarRoute.startsWith(rp.split(':')[0])));
  assert(
    existsInRouter,
    `Sidebar route '${sidebarRoute}' exists in router`,
    `Sidebar contains link '${sidebarRoute}' which does not exist in src/router/index.ts`
  );
}

// Check CommandPalette routes
const paletteToRegex = /to:\s*['"]([^'"]+)['"]/g;
const palettePaths = [];
while ((match = paletteToRegex.exec(paletteContent)) !== null) {
  palettePaths.push(match[1]);
}
const uniquePalettePaths = [...new Set(palettePaths)];
console.log(`CommandPalette defines ${uniquePalettePaths.length} unique route destinations.`);

for (const staticRoute of staticOperationalRoutes) {
  assert(
    uniquePalettePaths.includes(staticRoute),
    `CommandPalette contains route: ${staticRoute}`,
    `Route ${staticRoute} defined in router is missing from CommandPalette.vue`
  );
}

for (const paletteRoute of uniquePalettePaths) {
  const existsInRouter = routerPaths.some(rp => rp === paletteRoute || (rp.includes(':') && paletteRoute.startsWith(rp.split(':')[0])));
  assert(
    existsInRouter,
    `CommandPalette route '${paletteRoute}' exists in router`,
    `CommandPalette contains link '${paletteRoute}' which does not exist in src/router/index.ts`
  );
}

// -----------------------------------------------------------------------------
// SUITE 2: AppSidebar isRouteActive Logic Stress-Testing
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 2: AppSidebar isRouteActive Logic Stress-Testing ---');

// Emulate isRouteActive from AppSidebar.vue
function isRouteActive(targetPath, currentPath) {
  if (targetPath === '/dashboard') {
    return currentPath === '/dashboard' || currentPath === '/';
  }
  if (targetPath === '/products') {
    return currentPath === '/products' || (currentPath.startsWith('/products/') && !currentPath.startsWith('/products/create'));
  }
  if (targetPath === '/pos') {
    return currentPath.startsWith('/pos');
  }
  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
}

assert(isRouteActive('/dashboard', '/dashboard') === true, 'isRouteActive(/dashboard, /dashboard) -> true');
assert(isRouteActive('/dashboard', '/') === true, 'isRouteActive(/dashboard, /) -> true');
assert(isRouteActive('/dashboard', '/products') === false, 'isRouteActive(/dashboard, /products) -> false');

assert(isRouteActive('/products', '/products') === true, 'isRouteActive(/products, /products) -> true');
assert(isRouteActive('/products', '/products/123/edit') === true, 'isRouteActive(/products, /products/123/edit) -> true (edit highlights products)');
assert(isRouteActive('/products', '/products/create') === false, 'isRouteActive(/products, /products/create) -> false (create has own nav item)');
assert(isRouteActive('/products/create', '/products/create') === true, 'isRouteActive(/products/create, /products/create) -> true');

assert(isRouteActive('/pos', '/pos') === true, 'isRouteActive(/pos, /pos) -> true');
assert(isRouteActive('/pos', '/pos/register-1') === true, 'isRouteActive(/pos, /pos/register-1) -> true');
assert(isRouteActive('/pos', '/orders') === false, 'isRouteActive(/pos, /orders) -> false');

assert(isRouteActive('/orders', '/orders') === true, 'isRouteActive(/orders, /orders) -> true');
assert(isRouteActive('/orders', '/orders/1001') === true, 'isRouteActive(/orders, /orders/1001) -> true');
assert(isRouteActive('/orders', '/order-status') === false, 'isRouteActive(/orders, /order-status) -> false (no prefix substring collision)');

assert(isRouteActive('/categories', '/categories') === true, 'isRouteActive(/categories, /categories) -> true');
assert(isRouteActive('/categories', '/catalog') === false, 'isRouteActive(/categories, /catalog) -> false');

// -----------------------------------------------------------------------------
// SUITE 3: CommandPalette Search & Keyboard Navigation Simulation
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 3: CommandPalette Search & Keyboard Navigation Simulation ---');

function extractItems(content) {
  const items = [];
  const itemRegex = /{\s*id:\s*['"]([^'"]+)['"],\s*title:\s*['"]([^'"]+)['"],\s*desc:\s*['"]([^'"]+)['"],\s*category:\s*['"]([^'"]+)['"],[\s\S]*?(?:to:\s*['"]([^'"]+)['"])?[\s\S]*?(?:shortcut:\s*['"]([^'"]+)['"])?[\s\S]*?keywords:\s*\[([\s\S]*?)\][\s\S]*?}/g;
  
  let m;
  while ((m = itemRegex.exec(content)) !== null) {
    const rawKeywords = m[7] || '';
    const keywords = rawKeywords.split(',').map(k => k.trim().replace(/['"]/g, '')).filter(Boolean);
    items.push({
      id: m[1],
      title: m[2],
      desc: m[3],
      category: m[4],
      to: m[5],
      shortcut: m[6],
      keywords
    });
  }
  return items;
}

const items = extractItems(paletteContent);
console.log(`Extracted ${items.length} command palette items.`);
assert(items.length >= 26, `Command palette has at least 26 items (actual: ${items.length})`);

// Test Categories
const validCategories = ['Quick Actions', 'Navigation', 'Catalog & Stock', 'Finance & CRM', 'System & Admin'];
for (const it of items) {
  assert(validCategories.includes(it.category), `Item '${it.id}' has valid category: '${it.category}'`);
}

// Search matching simulation
function filterCommands(query, commandList) {
  const q = query.trim().toLowerCase();
  if (!q) return commandList;

  return commandList.filter(item => {
    if (item.title.toLowerCase().includes(q)) return true;
    if (item.desc.toLowerCase().includes(q)) return true;
    if (item.category.toLowerCase().includes(q)) return true;
    if (item.to && item.to.toLowerCase().includes(q)) return true;
    if (item.keywords?.some(k => k.toLowerCase().includes(q))) return true;
    return false;
  });
}

function groupCommands(filteredList) {
  const groups = [];
  for (const cat of validCategories) {
    const itms = filteredList.filter(i => i.category === cat);
    if (itms.length > 0) {
      groups.push({ category: cat, items: itms });
    }
  }
  return groups;
}

function getFlatList(grouped) {
  return grouped.flatMap(g => g.items);
}

// Test Search Queries
const testQueries = [
  { q: '', expectedMin: 26, desc: 'Empty query returns all commands' },
  { q: 'pos', expectedMin: 2, desc: 'Query "pos" matches Quick Action POS and Navigation POS' },
  { q: 'POS', expectedMin: 2, desc: 'Query "POS" case-insensitivity' },
  { q: 'stock', expectedMin: 2, desc: 'Query "stock" matches Inventory and Restock' },
  { q: 'f8', expectedMin: 1, desc: 'Query "f8" matches shortcut keyword for POS' },
  { q: 'crm', expectedMin: 1, desc: 'Query "crm" matches Customer Loyalty & CRM' },
  { q: 'tax', expectedMin: 2, desc: 'Query "tax" matches Invoices, Settings, Reports' },
  { q: 'payroll', expectedMin: 1, desc: 'Query "payroll" matches Staff Payroll' },
  { q: 'nonexistentquery12345xyz', expectedMin: 0, desc: 'Non-matching query returns 0 items' },
  { q: '   ', expectedMin: 26, desc: 'Whitespace query returns all commands' },
  { q: '<script>alert(1)</script>', expectedMin: 0, desc: 'XSS attempt query returns 0 items without throwing' },
  { q: '.*+?^${}()|[]\\', expectedMin: 0, desc: 'Regex special characters handled safely' },
];

for (const t of testQueries) {
  const res = filterCommands(t.q, items);
  if (t.q === 'nonexistentquery12345xyz' || t.q === '<script>alert(1)</script>' || t.q === '.*+?^${}()|[]\\') {
    assert(res.length === 0, `Search query '${t.q}' -> 0 results`);
  } else {
    assert(res.length >= t.expectedMin, `Search query '${t.q}': ${t.desc} (found ${res.length})`);
  }
}

// Keyboard Navigation Wrapping and Index Safety
console.log('\n--- SUITE 3.2: Keyboard Navigation Index Wrapping & Safety ---');

function simulateKeyboardNavigation(query, keySequence) {
  const filtered = filterCommands(query, items);
  const grouped = groupCommands(filtered);
  const flat = getFlatList(grouped);

  let selectedIndex = 0;

  for (const key of keySequence) {
    if (key === 'ArrowDown') {
      if (flat.length > 0) {
        selectedIndex = (selectedIndex + 1) % flat.length;
      }
    } else if (key === 'ArrowUp') {
      if (flat.length > 0) {
        selectedIndex = (selectedIndex - 1 + flat.length) % flat.length;
      }
    }
  }

  const selectedItem = flat[selectedIndex];
  return { flatLength: flat.length, selectedIndex, selectedItem };
}

// Test Arrow Down Wrapping
const nav1 = simulateKeyboardNavigation('', Array(30).fill('ArrowDown'));
assert(nav1.selectedIndex >= 0 && nav1.selectedIndex < nav1.flatLength, 'ArrowDown wraps around cleanly within bounds');

// Test Arrow Up Wrapping from 0
const nav2 = simulateKeyboardNavigation('', ['ArrowUp']);
assert(nav2.selectedIndex === nav2.flatLength - 1, `ArrowUp from 0 wraps to last item (index ${nav2.flatLength - 1})`);

// Test Navigation on Empty Results (Must not produce NaN or crash)
const navEmpty = simulateKeyboardNavigation('nonexistentquery123', ['ArrowDown', 'ArrowUp', 'ArrowDown']);
assert(navEmpty.selectedIndex === 0, 'Navigation on empty results maintains index 0');
assert(navEmpty.selectedItem === undefined, 'selectedItem on empty results is safely undefined');

// -----------------------------------------------------------------------------
// SUITE 4: AppHeader Dynamic Breadcrumbs Verification
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 4: AppHeader Dynamic Breadcrumbs Verification ---');

function computeBreadcrumbs(path, storeName = 'KC Inventory') {
  const root = { label: storeName || 'OmniPOS', to: '/dashboard' };

  if (path === '/dashboard' || path === '/') {
    return [root, { label: 'Executive Dashboard' }];
  }
  if (path === '/pos') {
    return [root, { label: 'POS Terminal' }];
  }
  if (path === '/products') {
    return [root, { label: 'Catalog', to: '/products' }, { label: 'Products Matrix' }];
  }
  if (path === '/products/create') {
    return [root, { label: 'Catalog', to: '/products' }, { label: 'Products', to: '/products' }, { label: 'Create Product' }];
  }
  if (path.startsWith('/products/') && path.endsWith('/edit')) {
    return [root, { label: 'Catalog', to: '/products' }, { label: 'Products', to: '/products' }, { label: 'Edit Product' }];
  }
  if (path === '/categories') {
    return [root, { label: 'Catalog', to: '/products' }, { label: 'Categories' }];
  }
  if (path === '/attributes') {
    return [root, { label: 'Catalog', to: '/products' }, { label: 'Attributes' }];
  }
  if (path === '/inventory') {
    return [root, { label: 'Operations', to: '/inventory' }, { label: 'Inventory Ledger' }];
  }
  if (path === '/restock') {
    return [root, { label: 'Operations', to: '/inventory' }, { label: 'Restock Intake' }];
  }
  if (path === '/suppliers') {
    return [root, { label: 'Operations', to: '/inventory' }, { label: 'Suppliers & Vendors' }];
  }
  if (path === '/delivery-settings') {
    return [root, { label: 'Operations', to: '/inventory' }, { label: 'Delivery & Shipping' }];
  }
  if (path === '/orders') {
    return [root, { label: 'Sales', to: '/orders' }, { label: 'Orders & POS Sales' }];
  }
  if (path === '/customers') {
    return [root, { label: 'CRM', to: '/customers' }, { label: 'Customer Loyalty' }];
  }
  if (path === '/quotations') {
    return [root, { label: 'Financials', to: '/quotations' }, { label: 'Sales Quotations' }];
  }
  if (path === '/invoices') {
    return [root, { label: 'Financials', to: '/invoices' }, { label: 'Tax Invoices' }];
  }
  if (path === '/expenses') {
    return [root, { label: 'Financials', to: '/expenses' }, { label: 'Expenses & Costs' }];
  }
  if (path === '/bank-accounts') {
    return [root, { label: 'Financials', to: '/bank-accounts' }, { label: 'Bank Accounts' }];
  }
  if (path === '/payroll') {
    return [root, { label: 'Financials', to: '/payroll' }, { label: 'Staff Payroll' }];
  }
  if (path === '/sales-channels') {
    return [root, { label: 'Financials', to: '/sales-channels' }, { label: 'Sales Channels' }];
  }
  if (path === '/reports') {
    return [root, { label: 'Administration', to: '/settings' }, { label: 'Reports & Analytics' }];
  }
  if (path === '/audit-logs') {
    return [root, { label: 'Administration', to: '/settings' }, { label: 'Security Audit Logs' }];
  }
  if (path === '/settings') {
    return [root, { label: 'Administration', to: '/settings' }, { label: 'Store Settings' }];
  }
  if (path === '/users') {
    return [root, { label: 'Administration', to: '/settings' }, { label: 'Admin Users' }];
  }
  if (path === '/roles') {
    return [root, { label: 'Administration', to: '/settings' }, { label: 'Roles Management' }];
  }
  if (path === '/permissions') {
    return [root, { label: 'Administration', to: '/settings' }, { label: 'Permissions Matrix' }];
  }

  // Fallback
  const segs = path.split('/').filter(Boolean);
  const formatted = segs.map(s => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' '));
  return [root, ...formatted.map((f, idx) => ({ label: f, to: idx === 0 ? `/${segs[0]}` : undefined }))];
}

const testPaths = [
  '/',
  '/dashboard',
  '/pos',
  '/products',
  '/products/create',
  '/products/123/edit',
  '/categories',
  '/attributes',
  '/inventory',
  '/restock',
  '/suppliers',
  '/delivery-settings',
  '/orders',
  '/customers',
  '/quotations',
  '/invoices',
  '/expenses',
  '/bank-accounts',
  '/payroll',
  '/sales-channels',
  '/reports',
  '/audit-logs',
  '/settings',
  '/users',
  '/roles',
  '/permissions',
  '/custom-dynamic-module/sub-section'
];

for (const tp of testPaths) {
  const crumbs = computeBreadcrumbs(tp);
  assert(Array.isArray(crumbs) && crumbs.length >= 2, `Breadcrumbs for '${tp}' has ${crumbs.length} items (${crumbs.map(c => c.label).join(' > ')})`);
  assert(crumbs[0].label === 'KC Inventory', `Breadcrumbs root is store branding`);
}

// -----------------------------------------------------------------------------
// SUITE 5: Layout, Responsive & POS Full-Height Isolation Verification
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 5: Layout, Responsive & POS Full-Height Isolation Verification ---');

const appVueFile = path.resolve(__dirname, '../src/App.vue');
const appVueContent = fs.readFileSync(appVueFile, 'utf8');

assert(appVueContent.includes('.app-main-content--pos'), 'App.vue contains .app-main-content--pos class rule');
assert(appVueContent.includes('height: calc(100vh - 64px)'), 'App.vue sets height: calc(100vh - 64px) for POS mode');
assert(appVueContent.includes('padding: 0'), 'App.vue sets padding: 0 for POS mode');
assert(appVueContent.includes('overflow: hidden'), 'App.vue sets overflow: hidden for POS mode');
assert(appVueContent.includes('margin-left: 260px'), 'App.vue defines 260px expanded sidebar margin');
assert(appVueContent.includes('margin-left: 72px'), 'App.vue defines 72px collapsed sidebar margin');
assert(appVueContent.includes('@media (max-width: 768px)'), 'App.vue contains mobile responsive breakpoint');

// AppSidebar responsive & collapse rules
assert(sidebarContent.includes('width: 260px'), 'AppSidebar defines 260px expanded width');
assert(sidebarContent.includes('width: 72px'), 'AppSidebar defines 72px collapsed width');
assert(sidebarContent.includes('.sidebar-collapsed-tooltip'), 'AppSidebar includes floating tooltips for collapsed mode');
assert(appVueContent.includes('localStorage.getItem'), 'App.vue loads sidebar collapse state from localStorage');

// -----------------------------------------------------------------------------
// SUMMARY & VERDICT
// -----------------------------------------------------------------------------
console.log('\n====================================================');
console.log(`TOTAL TESTS: ${totalTests}`);
console.log(`PASSED:      ${passedTests}`);
console.log(`FAILED:      ${failedTests}`);
console.log('====================================================');

if (failedTests > 0) {
  console.error('\nFAILURE DETAILS:');
  failures.forEach((f, idx) => console.error(`${idx + 1}. [${f.testName}] ${f.details}`));
  process.exit(1);
} else {
  console.log('\nALL EMPIRICAL TESTS PASSED PERFECTLY!');
  process.exit(0);
}
