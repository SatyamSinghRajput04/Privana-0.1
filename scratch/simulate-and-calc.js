// Let's create a deterministic simulated dataset using a seeded random function to test math functions.
class SeededRandom {
  constructor(seed) {
    this.seed = seed;
  }
  next() {
    // LCG random generator
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }
}

const rng = new SeededRandom(42);
const random = () => rng.next();

// Generate dataset EXACTLY as in DatasetsPage.tsx (but with seeded rng)
function generateDataset() {
  const genders = [
    ...Array(615).fill('male'),
    ...Array(585).fill('female')
  ];

  const platforms = [
    ...Array(427).fill('Instagram'),
    ...Array(366).fill('TikTok'),
    ...Array(206).fill('YouTube'),
    ...Array(124).fill('Snapchat'),
    ...Array(77).fill('Twitter')
  ];

  const anxietyLevels = [];
  for (let i = 0; i < 182; i++) anxietyLevels.push(i % 2 === 0 ? 1 : 2);
  for (let i = 0; i < 321; i++) anxietyLevels.push(i % 2 === 0 ? 3 : 4);
  for (let i = 0; i < 372; i++) anxietyLevels.push(i % 2 === 0 ? 5 : 6);
  for (let i = 0; i < 231; i++) anxietyLevels.push(i % 2 === 0 ? 7 : 8);
  for (let i = 0; i < 94; i++) anxietyLevels.push(i % 2 === 0 ? 9 : 10);

  // Fisher-Yates shuffle with seeded RNG
  const shuffle = (arr) => {
    let cur = arr.length, rand;
    while (cur !== 0) {
      rand = Math.floor(random() * cur);
      cur--;
      [arr[cur], arr[rand]] = [arr[rand], arr[cur]];
    }
    return arr;
  };

  shuffle(platforms);
  shuffle(anxietyLevels);

  const sleepHours = [];
  let maleSleepSum = 0;
  let femaleSleepSum = 0;

  const ages = [];
  let maleAgeSum = 0;
  let femaleAgeSum = 0;

  for (let i = 0; i < 1200; i++) {
    const isMale = genders[i] === 'male';
    let sleepVal = isMale 
      ? 6.40 + (random() * 2.4 - 1.2)
      : 6.50 + (random() * 2.4 - 1.2);
    sleepVal = Math.round(sleepVal * 10) / 10;

    if (isMale) maleSleepSum += sleepVal;
    else femaleSleepSum += sleepVal;
    sleepHours.push(sleepVal);

    let ageVal = isMale
      ? 15.95 + (random() * 6 - 3)
      : 15.91 + (random() * 6 - 3);
    ageVal = Math.max(13, Math.min(19, Math.round(ageVal)));
    if (isMale) maleAgeSum += ageVal;
    else femaleAgeSum += ageVal;
    ages.push(ageVal);
  }

  // Adjust sums exactly
  const maleIndices = genders.map((g, idx) => g === 'male' ? idx : -1).filter(idx => idx !== -1);
  const femaleIndices = genders.map((g, idx) => g === 'female' ? idx : -1).filter(idx => idx !== -1);

  let maleSleepDiff = 3936.0 - maleSleepSum;
  while (Math.abs(maleSleepDiff) > 0.05) {
    const idx = maleIndices[Math.floor(random() * maleIndices.length)];
    const delta = maleSleepDiff > 0 ? 0.1 : -0.1;
    sleepHours[idx] = Math.round((sleepHours[idx] + delta) * 10) / 10;
    maleSleepSum += delta;
    maleSleepDiff = 3936.0 - maleSleepSum;
  }

  let femaleSleepDiff = 3802.5 - femaleSleepSum;
  while (Math.abs(femaleSleepDiff) > 0.05) {
    const idx = femaleIndices[Math.floor(random() * femaleIndices.length)];
    const delta = femaleSleepDiff > 0 ? 0.1 : -0.1;
    sleepHours[idx] = Math.round((sleepHours[idx] + delta) * 10) / 10;
    femaleSleepSum += delta;
    femaleSleepDiff = 3802.5 - femaleSleepSum;
  }

  let maleAgeDiff = 9810 - maleAgeSum;
  while (maleAgeDiff !== 0) {
    const idx = maleIndices[Math.floor(random() * maleIndices.length)];
    const delta = maleAgeDiff > 0 ? 1 : -1;
    const newVal = ages[idx] + delta;
    if (newVal >= 13 && newVal <= 19) {
      ages[idx] = newVal;
      maleAgeSum += delta;
      maleAgeDiff = 9810 - maleAgeSum;
    }
  }

  let femaleAgeDiff = 9307 - femaleAgeSum;
  while (femaleAgeDiff !== 0) {
    const idx = femaleIndices[Math.floor(random() * femaleIndices.length)];
    const delta = femaleAgeDiff > 0 ? 1 : -1;
    const newVal = ages[idx] + delta;
    if (newVal >= 13 && newVal <= 19) {
      ages[idx] = newVal;
      femaleAgeSum += delta;
      femaleAgeDiff = 9307 - femaleAgeSum;
    }
  }

  const screenTimeSlots = [
    ...Array(100).fill(0.0),
    ...Array(120).fill(0.5),
    ...Array(160).fill(1.0),
    ...Array(200).fill(1.5),
    ...Array(240).fill(2.0),
    ...Array(180).fill(2.5),
    ...Array(200).fill(3.0)
  ];
  shuffle(screenTimeSlots);

  const stressLevels = [];
  let stressSum = 0;

  for (let i = 0; i < 1200; i++) {
    const st = screenTimeSlots[i];
    let baseStress = 3.0 + (st / 3.0) * 3.6;
    let stressVal = Math.round(baseStress + (random() * 4 - 2));
    stressVal = Math.max(1, Math.min(10, stressVal));
    stressLevels.push(stressVal);
    stressSum += stressVal;
  }

  let stressDiff = 6120 - stressSum;
  while (stressDiff !== 0) {
    const idx = Math.floor(random() * 1200);
    const delta = stressDiff > 0 ? 1 : -1;
    const newVal = stressLevels[idx] + delta;
    if (newVal >= 1 && newVal <= 10) {
      stressLevels[idx] = newVal;
      stressSum += delta;
      stressDiff = 6120 - stressSum;
    }
  }

  const sampleData = [];
  for (let i = 0; i < 1200; i++) {
    sampleData.push({
      age: ages[i],
      gender: genders[i],
      sleep_hours: sleepHours[i],
      platform_usage: platforms[i],
      stress_level: stressLevels[i],
      anxiety_level: anxietyLevels[i],
      screen_time_before_sleep: screenTimeSlots[i]
    });
  }
  return sampleData;
}

// Math Helpers
function mean(arr) {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stdDev(arr, sample = true) {
  const m = mean(arr);
  const sumSq = arr.reduce((s, v) => s + Math.pow(v - m, 2), 0);
  return Math.sqrt(sumSq / (arr.length - (sample ? 1 : 0)));
}

function pearsonR(xs, ys) {
  const mx = mean(xs), my = mean(ys);
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const den = Math.sqrt(
    xs.reduce((s, x) => s + Math.pow(x - mx, 2), 0) *
    ys.reduce((s, y) => s + Math.pow(y - my, 2), 0)
  );
  return den === 0 ? 0 : num / den;
}

function getRanks(values) {
  const sorted = values.map((val, idx) => ({ val, idx })).sort((a, b) => a.val - b.val);
  const ranks = new Array(values.length);
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j < sorted.length && sorted[j].val === sorted[i].val) {
      j++;
    }
    const rank = 1 + (i + j - 1) / 2;
    for (let k = i; k < j; k++) {
      ranks[sorted[k].idx] = rank;
    }
    i = j;
  }
  return ranks;
}

function spearmanR(xs, ys) {
  return pearsonR(getRanks(xs), getRanks(ys));
}

function tTestCorrelation(r, n) {
  if (n <= 2) return { t: 0, p: 1 };
  const t = r * Math.sqrt((n - 2) / (1 - r * r));
  // Standard Normal approximation for two-tailed p-value
  const z = Math.abs(t);
  // error function approximation
  const p = 2 * (1 - 0.5 * (1 + Math.sign(z) * Math.sqrt(1 - Math.exp(-2 * z * z / Math.PI))));
  return { t, p };
}

function skewnessKurtosis(vals) {
  const n = vals.length;
  if (n < 3) return { skewness: 0, kurtosis: 0 };
  const m = mean(vals);
  const m2 = vals.reduce((s, v) => s + Math.pow(v - m, 2), 0) / n;
  const m3 = vals.reduce((s, v) => s + Math.pow(v - m, 3), 0) / n;
  const m4 = vals.reduce((s, v) => s + Math.pow(v - m, 4), 0) / n;
  if (m2 === 0) return { skewness: 0, kurtosis: 0 };
  
  const skew = m3 / Math.pow(m2, 1.5);
  const excessKurt = m4 / Math.pow(m2, 2) - 3;
  
  const adjSkew = (Math.sqrt(n * (n - 1)) / (n - 2)) * skew;
  const adjKurt = ((n - 1) / ((n - 2) * (n - 3))) * ((n + 1) * excessKurt + 6);
  
  return { skewness: adjSkew, kurtosis: adjKurt };
}

function runRegression(xs, ys) {
  const n = xs.length;
  const mx = mean(xs), my = mean(ys);
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const den = xs.reduce((s, x) => s + Math.pow(x - mx, 2), 0);
  const slope = den === 0 ? 0 : num / den;
  const intercept = my - slope * mx;

  let totalSS = 0, residualSS = 0;
  for (let i = 0; i < n; i++) {
    const pred = slope * xs[i] + intercept;
    totalSS += Math.pow(ys[i] - my, 2);
    residualSS += Math.pow(ys[i] - pred, 2);
  }
  const r2 = totalSS === 0 ? 0 : 1 - (residualSS / totalSS);
  const seReg = Math.sqrt(residualSS / (n - 2));

  return { slope, intercept, r2, seReg };
}

const data = generateDataset();
const val = data.map(d => d.screen_time_before_sleep);
const cnt = data.map(d => d.stress_level);

console.log('--- Statistical Checks ---');
console.log(`Pearson correlation r: ${pearsonR(val, cnt).toFixed(4)}`);
console.log(`Spearman correlation rs: ${spearmanR(val, cnt).toFixed(4)}`);

const tSig = tTestCorrelation(pearsonR(val, cnt), data.length);
console.log(`t-statistic: ${tSig.t.toFixed(4)}, p-value: ${tSig.p.toExponential(4)}`);

const reg = runRegression(val, cnt);
console.log(`Regression: y = ${reg.slope.toFixed(4)} * x + ${reg.intercept.toFixed(4)}`);
console.log(`R²: ${reg.r2.toFixed(4)}, SE of Regression: ${reg.seReg.toFixed(4)}`);

const pred22 = reg.slope * 22 + reg.intercept;
console.log(`Prediction for value=22: ${pred22.toFixed(4)}`);

const sk = skewnessKurtosis(cnt);
console.log(`Skewness of count: ${sk.skewness.toFixed(4)}, Kurtosis of count: ${sk.kurtosis.toFixed(4)}`);

