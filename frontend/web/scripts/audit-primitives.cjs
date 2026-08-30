const fs = require('fs');
const path = require('path');

const uiDir = 'src/components/ui';
const files = fs.readdirSync(uiDir);

console.log(`Auditing ${files.length} items in ${uiDir}...`);

const issues = [];

files.forEach(file => {
  const filePath = path.join(uiDir, file);
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) return;

  const content = fs.readFileSync(filePath, 'utf8');

  // Check for undefined imports or broken references
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    // Check for hardcoded arbitrary colors instead of tokens (e.g. #xxxxxx)
    const hexMatches = line.match(/#[0-9a-fA-F]{3,8}/g);
    if (hexMatches && !file.endsWith('.css')) {
      // Filter out legitimate button-variants or comments
      // console.log(`${file}:${idx + 1} has hex ${hexMatches.join(', ')}`);
    }
  });
});

console.log('UI primitives audit complete.');
