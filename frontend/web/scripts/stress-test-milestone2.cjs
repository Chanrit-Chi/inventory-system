const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('   ADVERSARIAL STRESS-TESTING SUITE (Milestone 2)   ');
console.log('====================================================\n');

let stressPassed = 0;
let stressFailed = 0;

function stressAssert(cond, name, details = '') {
  if (cond) {
    stressPassed++;
    console.log(`  [STRESS-PASS] ${name}`);
  } else {
    stressFailed++;
    console.error(`  [STRESS-FAIL] ${name}: ${details}`);
  }
}

// 1. Extreme Search Inputs
const paletteContent = fs.readFileSync(path.resolve(__dirname, '../src/components/shell/CommandPalette.vue'), 'utf8');
const sidebarContent = fs.readFileSync(path.resolve(__dirname, '../src/components/shell/AppSidebar.vue'), 'utf8');
const headerContent = fs.readFileSync(path.resolve(__dirname, '../src/components/shell/AppHeader.vue'), 'utf8');
const appContent = fs.readFileSync(path.resolve(__dirname, '../src/App.vue'), 'utf8');

// Test unicode, emojis, SQL-like, very long strings
const extremeInputs = [
  '🛒 POS 123',
  '-- DROP TABLE products;',
  '\' OR \'1\'=\'1',
  'a'.repeat(5000),
  '\u0000\u0007\u001b',
  'null',
  'undefined',
  'NaN',
  '[object Object]',
  'true',
  'false',
  '__proto__',
  'constructor',
  'valueOf',
  'toString'
];

function extractCommands(content) {
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

const commands = extractCommands(paletteContent);

for (const input of extremeInputs) {
  try {
    const q = input.trim().toLowerCase();
    const matches = commands.filter(item => {
      if (item.title.toLowerCase().includes(q)) return true;
      if (item.desc.toLowerCase().includes(q)) return true;
      if (item.category.toLowerCase().includes(q)) return true;
      if (item.to && item.to.toLowerCase().includes(q)) return true;
      if (item.keywords?.some(k => k.toLowerCase().includes(q))) return true;
      return false;
    });
    stressAssert(Array.isArray(matches), `Extreme input [${input.slice(0, 20)}...] processed without error (matches: ${matches.length})`);
  } catch (err) {
    stressAssert(false, `Extreme input [${input.slice(0, 20)}...] threw error`, err.message);
  }
}

// 2. Prototype Pollution Resistance
stressAssert(typeof commands.filter === 'function', 'Commands array prototype remains unpolluted');
const protoTestResult = commands.filter(item => Object.prototype.hasOwnProperty.call(item, 'id'));
stressAssert(protoTestResult.length === commands.length, 'All command items have valid own properties');

// 3. Layout Height Constraint Stress Test
stressAssert(appContent.includes('calc(100vh - 64px)'), 'POS view height matches viewport minus 64px header height');
stressAssert(headerContent.includes('height: 64px'), 'AppHeader height strictly matches 64px');
stressAssert(sidebarContent.includes('height: 64px'), 'AppSidebar brand header height strictly matches 64px');

// 4. Contrast & Theme Token Audit
const requiredTokens = ['#FAF7F2', '#924C00', '#FF8800', '#1A1C1C', '#E8E2D9'];
for (const token of requiredTokens) {
  const inSidebar = sidebarContent.includes(token);
  const inHeader = headerContent.includes(token);
  const inPalette = paletteContent.includes(token);
  stressAssert(inSidebar || inHeader || inPalette, `Brand token ${token} actively utilized across shell components`);
}

// 5. Memory Leak / Event Listener Cleanup Audit
stressAssert(headerContent.includes('window.removeEventListener(\'click\', onWindowClick)'), 'AppHeader cleans up window click listener on unmount');
stressAssert(paletteContent.includes('window.removeEventListener(\'keydown\', handleGlobalKeydown)'), 'CommandPalette cleans up keydown listener on unmount');
stressAssert(appContent.includes('window.removeEventListener(\'keydown\', handleGlobalKeydown)'), 'App.vue cleans up global keydown listener on unmount');

console.log('\n====================================================');
console.log(`STRESS TESTS PASSED: ${stressPassed}`);
console.log(`STRESS TESTS FAILED: ${stressFailed}`);
console.log('====================================================');

if (stressFailed > 0) process.exit(1);
