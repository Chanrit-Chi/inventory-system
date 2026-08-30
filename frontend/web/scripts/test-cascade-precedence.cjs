const { execSync } = require('child_process');
const fs = require('fs');

// Let's test how Vite builds TableCell.vue and whether unlayered styles conflict
console.log('Testing build output and CSS layers in dist/assets/index-*.css');

const cssFiles = fs.readdirSync('dist/assets').filter(f => f.endsWith('.css'));
if (cssFiles.length === 0) {
  console.log('No css found in dist/assets. Running npm run build...');
  execSync('npm run build', { stdio: 'inherit' });
}

const cssFile = fs.readdirSync('dist/assets').find(f => f.endsWith('.css'));
const distCss = fs.readFileSync(`dist/assets/${cssFile}`, 'utf8');

console.log(`Analyzing bundle CSS (${cssFile}, size: ${(distCss.length / 1024).toFixed(2)} KB)...`);

// Check if @layer is used in output
const hasLayer = distCss.includes('@layer');
console.log('Does output contain @layer?', hasLayer);

// Check location of thead th and tbody td in distCss
const theadIndex = distCss.indexOf('thead th');
const tableCellIndex = distCss.indexOf('p-2');

console.log('Index of "thead th":', theadIndex);
console.log('Index of "p-2" (utility):', tableCellIndex);
console.log('Is thead th after utility layer or unlayered?', theadIndex > 0);
