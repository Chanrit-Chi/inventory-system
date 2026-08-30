const fs = require('fs');
const path = require('path');

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const num = parseInt(hex, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function sRgbToLin(c) {
  c = c / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * sRgbToLin(r) + 0.7152 * sRgbToLin(g) + 0.0722 * sRgbToLin(b);
}

function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function evaluateWCAG(fg, bg, label) {
  const cr = contrastRatio(fg, bg);
  const passAANormal = cr >= 4.5;
  const passAALarge = cr >= 3.0;
  const passAAANormal = cr >= 7.0;
  const passAAALarge = cr >= 4.5;

  return {
    label,
    fg,
    bg,
    cr: Number(cr.toFixed(2)),
    passAANormal,
    passAALarge,
    passAAANormal,
    passAAALarge,
    status: passAANormal ? 'PASS (AA Normal)' : (passAALarge ? 'PASS (AA Large only / FAIL Normal)' : 'FAIL (All WCAG AA)')
  };
}

const colorPairs = [
  // Core text & backgrounds
  ['#1A1C1C', '#FAF7F2', 'foreground on background (Warm Cream)'],
  ['#1A1C1C', '#FFFFFF', 'foreground on surface/card (White)'],
  ['#1A1C1C', '#F8F5F0', 'foreground on surface-subtle'],
  ['#1A1C1C', '#F0EAE1', 'foreground on surface-muted / muted'],
  ['#7A7268', '#FAF7F2', 'muted-foreground on background'],
  ['#7A7268', '#FFFFFF', 'muted-foreground on surface/card'],
  ['#7A7268', '#F8F5F0', 'muted-foreground on surface-subtle'],
  ['#7A7268', '#F0EAE1', 'muted-foreground on muted bg'],
  ['#574335', '#F0EAE1', 'secondary-foreground on secondary bg'],
  ['#924C00', '#FFF3E0', 'accent-foreground (amber) on accent bg'],

  // Brand Actions
  ['#FFFFFF', '#924C00', 'primary-foreground on primary (Deep Amber)'],
  ['#FFFFFF', '#7A3F00', 'primary-foreground on primary-hover'],
  ['#FFFFFF', '#613000', 'primary-foreground on primary-active'],
  ['#FFFFFF', '#FF8800', 'cta-foreground (White) on CTA (Vibrant Orange)'],
  ['#FFFFFF', '#E67A00', 'cta-foreground (White) on CTA-hover'],
  ['#FFFFFF', '#C66800', 'cta-foreground (White) on CTA-active'],
  ['#FF8800', '#FFFFFF', 'CTA (Orange) text on White surface'],
  ['#FF8800', '#FAF7F2', 'CTA (Orange) text on Warm Cream background'],
  ['#FF8800', '#FFF3E0', 'CTA (Orange) text on CTA-muted (Peach/Cream)'],
  ['#924C00', '#FFFFFF', 'Deep Amber text on White surface'],
  ['#924C00', '#FAF7F2', 'Deep Amber text on Warm Cream bg'],

  // Status & Feedback
  ['#FFFFFF', '#BA1A1A', 'destructive-foreground on destructive'],
  ['#065F46', '#ECFDF5', 'success-text on success-bg'],
  ['#FFFFFF', '#10B981', 'White text on success emerald (#10B981) [btn--success]'],
  ['#FFFFFF', '#059669', 'White text on success-hover (#059669)'],
  ['#92400E', '#FFFBEB', 'warning-text on warning-bg'],
  ['#93000A', '#FFDAD6', 'error-text on error-bg'],
  ['#0369A1', '#E0F2FE', 'info-text on info-bg'],
  ['#5B21B6', '#F5F3FF', 'purple-text on purple-bg'],

  // UI Borders vs Backgrounds (Non-text contrast, target 3.0:1)
  ['#E8E2D9', '#FAF7F2', 'border vs background (Warm Cream)'],
  ['#E8E2D9', '#FFFFFF', 'border vs surface (White)'],
  ['#D5CCC0', '#FAF7F2', 'border-strong vs background'],
  ['#D5CCC0', '#FFFFFF', 'border-strong vs surface'],

  // Loyalty badges
  ['#92400E', '#FEF3C7', 'Bronze badge text on bg'],
  ['#4B5563', '#F3F4F6', 'Silver badge text on bg'],
  ['#B45309', '#FEF9C3', 'Gold badge text on bg'],
  ['#5B21B6', '#EDE9FE', 'Platinum badge text on bg'],
];

const results = colorPairs.map(([fg, bg, label]) => evaluateWCAG(fg, bg, label));

console.log('=== WCAG CONTRAST EVALUATION RESULTS ===');
console.table(results);

const failures = results.filter(r => !r.passAANormal);
console.log('\n=== PAIRS FAILING WCAG AA (Normal Text < 4.5:1) ===');
failures.forEach(f => {
  console.log(`- [${f.label}] ${f.fg} on ${f.bg} => ${f.cr}:1 (${f.status})`);
});
