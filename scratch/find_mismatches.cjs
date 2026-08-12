const fs = require('fs');

const code = fs.readFileSync('src/pages/AnalyzePage_test.tsx', 'utf8');

// Strip out comments to avoid matching commented-out tags
const cleanCode = code
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*/g, '');

const tags = [
  'div',
  'Fragment',
  'ResponsiveContainer',
  'BarChart',
  'LineChart',
  'PieChart',
  'ComposedChart',
  'ScatterChart',
  'XAxis',
  'YAxis',
  'Tooltip',
  'Bar',
  'Line',
  'Pie',
  'Cell',
  'LabelList',
  'button',
  'span',
  'h1',
  'h2',
  'h3',
  'p',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'select',
  'option',
  'ul',
  'li',
  'code',
  'pre',
  'details',
  'summary',
  'STARTS_WITH_LESS_THAN_SHORTHAND_FRAGMENT' // <>
];

console.log('JSX Tag Balance Analysis:');

// Helper to count opening tags (excluding self-closing)
// e.g. <div but not <div />
const countOpen = (tagName) => {
  let regex;
  if (tagName === 'STARTS_WITH_LESS_THAN_SHORTHAND_FRAGMENT') {
    regex = /<>/g;
  } else {
    // Matches <TagName followed by spaces/props, ending in > but NOT />
    regex = new RegExp('<' + tagName + '(?:\\s+[^>]*[^/>])?\\s*>', 'g');
  }
  const matches = cleanCode.match(regex);
  return matches ? matches.length : 0;
};

const countClose = (tagName) => {
  let regex;
  if (tagName === 'STARTS_WITH_LESS_THAN_SHORTHAND_FRAGMENT') {
    regex = /<\/>/g;
  } else {
    regex = new RegExp('</' + tagName + '>', 'g');
  }
  const matches = cleanCode.match(regex);
  return matches ? matches.length : 0;
};

// Count self-closing occurrences just for information
const countSelfClosing = (tagName) => {
  if (tagName === 'STARTS_WITH_LESS_THAN_SHORTHAND_FRAGMENT') return 0;
  const regex = new RegExp('<' + tagName + '\\s+[^>]*/>', 'g');
  const matches = cleanCode.match(regex);
  return matches ? matches.length : 0;
};

tags.forEach(tag => {
  const op = countOpen(tag);
  const cl = countClose(tag);
  const sc = countSelfClosing(tag);
  if (op !== cl) {
    console.log(`❌ Tag <${tag}>: Open=${op}, Close=${cl} (Diff=${op - cl}) [Self-closing=${sc}]`);
  } else if (op > 0) {
    console.log(`✅ Tag <${tag}>: Balanced (${op} pairs) [Self-closing=${sc}]`);
  }
});
