const schema = [
  { name: 'age', type: 'number' },
  { name: 'gender', type: 'string' },
  { name: 'sleep_hours', type: 'number' },
  { name: 'platform_usage', type: 'string' },
  { name: 'stress_level', type: 'number' },
];

function stem(word) {
  word = word.toLowerCase().trim();
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) {
    return word.slice(0, -1);
  }
  return word;
}

function getMatchScore(colName, questionStems, questionRaw) {
  const cl = colName.toLowerCase();
  const clWords = cl.replace(/_/g, ' ');

  // Use regex with word boundaries instead of .includes to prevent "age" matching inside "average"
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const r1 = new RegExp('\\b' + esc(cl) + '\\b');
  const r2 = new RegExp('\\b' + esc(clWords) + '\\b');

  if (r1.test(questionRaw) || r2.test(questionRaw)) {
    return 2.0;
  }

  const colWords = colName.split(/[_\s]+/).map(w => w.trim()).filter(Boolean);
  const colStems = colWords.map(stem);

  let matches = 0;
  for (const stemVal of colStems) {
    if (questionStems.includes(stemVal)) {
      matches++;
    }
  }

  if (matches === 0) return 0;

  if (colStems.length === 1) {
    return matches === 1 ? 1.0 : 0;
  }

  const ratio = matches / colStems.length;

  if (matches === colStems.length) {
    return 1.8;
  }

  if (ratio >= 0.5) {
    return ratio;
  }

  return 0;
}

function findMentionedColumns(question, schema) {
  const ql = question.toLowerCase();
  const qWords = ql.split(/[^a-z0-9_]+/).map(w => w.trim()).filter(Boolean);
  const qStems = qWords.map(stem);

  const scored = schema.map(col => {
    const score = getMatchScore(col.name, qStems, ql);
    return { col, score };
  });

  return scored
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(x => x.col);
}

// Singular/plural checks
console.log('Test: "average sleep hour" (singular check)');
const r1 = findMentionedColumns('average sleep hour', schema);
console.log('  Matched:', r1.map(c => c.name));
console.log('  Expected: [sleep_hours] (NOT age)\n');

console.log('Test: "average sleep_hours" (exact check)');
const r2 = findMentionedColumns('average sleep_hours', schema);
console.log('  Matched:', r2.map(c => c.name));
console.log('  Expected: [sleep_hours]\n');

console.log('Test: "show me average ages" (plural check)');
const r3 = findMentionedColumns('show me average ages', schema);
console.log('  Matched:', r3.map(c => c.name));
console.log('  Expected: [age]\n');

console.log('Test: "what is the stress levels" (plural check for compound)');
const r4 = findMentionedColumns('what is the stress levels', schema);
console.log('  Matched:', r4.map(c => c.name));
console.log('  Expected: [stress_level]\n');
