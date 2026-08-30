const fs = require('fs');
const css = fs.readFileSync('src/style.css', 'utf8');

// Find all rule blocks
const ruleRegex = /([^{}]+)\{([^}]+)\}/g;
let match;
const allRules = [];
while ((match = ruleRegex.exec(css)) !== null) {
  const sel = match[1].trim();
  if (!sel.startsWith('@') && !sel.startsWith('from') && !sel.startsWith('to') && !sel.match(/^\d+%/)) {
    allRules.push(sel.replace(/\s+/g, ' '));
  }
}

console.log('Total rules in style.css:', allRules.length);

console.log('\n=== RULES TARGETING BARE ELEMENT TAGS ===');
allRules.forEach((sel, idx) => {
  if (sel.match(/(^|,\s*)(table|thead|tbody|tfoot|th|td|input|select|textarea|button|a|p|h[1-6]|ul|ol|li|::-webkit-scrollbar)\b/i)) {
    console.log(`- Rule ${idx}: ${sel}`);
  }
});
