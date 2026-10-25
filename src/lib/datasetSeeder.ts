export const teenMentalHealthColumns = [
  { name: 'age', type: 'INTEGER', is_he: false },
  { name: 'gender', type: 'VARCHAR', is_he: false },
  { name: 'sleep_hours', type: 'DECIMAL', is_he: false },
  { name: 'platform_usage', type: 'VARCHAR', is_he: false },
  { name: 'stress_level', type: 'INTEGER', is_he: false },
  { name: 'anxiety_level', type: 'INTEGER', is_he: false },
  { name: 'screen_time_before_sleep', type: 'DECIMAL', is_he: false },
  { name: 'depression_label', type: 'VARCHAR', is_he: false },
];

export function generateTeenMentalHealthDatasetCSV(): string {
  const genders = [
    ...Array(615).fill('male'),
    ...Array(585).fill('female')
  ];

  // Platform usage: 427 Instagram, 366 TikTok, 206 YouTube, 124 Snapchat, 77 Twitter
  const platforms = [
    ...Array(427).fill('Instagram'),
    ...Array(366).fill('TikTok'),
    ...Array(206).fill('YouTube'),
    ...Array(124).fill('Snapchat'),
    ...Array(77).fill('Twitter')
  ];

  // Anxiety levels: 182 Low, 321 Mild, 372 Moderate, 231 High, 94 Severe
  const anxietyLevels: number[] = [];
  for (let i = 0; i < 182; i++) anxietyLevels.push(i % 2 === 0 ? 1 : 2);
  for (let i = 0; i < 321; i++) anxietyLevels.push(i % 2 === 0 ? 3 : 4);
  for (let i = 0; i < 372; i++) anxietyLevels.push(i % 2 === 0 ? 5 : 6);
  for (let i = 0; i < 231; i++) anxietyLevels.push(i % 2 === 0 ? 7 : 8);
  for (let i = 0; i < 94; i++) anxietyLevels.push(i % 2 === 0 ? 9 : 10);

  const shuffle = (arr: any[]) => {
    let cur = arr.length, rand;
    while (cur !== 0) {
      rand = Math.floor(Math.random() * cur);
      cur--;
      [arr[cur], arr[rand]] = [arr[rand], arr[cur]];
    }
    return arr;
  };

  shuffle(platforms);
  shuffle(anxietyLevels);

  const sleepHours: number[] = [];
  let maleSleepSum = 0;
  let femaleSleepSum = 0;

  const ages: number[] = [];
  let maleAgeSum = 0;
  let femaleAgeSum = 0;

  // Generate sleep and ages
  for (let i = 0; i < 1200; i++) {
    const isMale = genders[i] === 'male';

    // Sleep hours: male target avg = 6.40, female target avg = 6.50
    let sleepVal = isMale 
      ? 6.40 + (Math.random() * 2.4 - 1.2)
      : 6.50 + (Math.random() * 2.4 - 1.2);
    sleepVal = Math.round(sleepVal * 10) / 10;

    if (isMale) maleSleepSum += sleepVal;
    else femaleSleepSum += sleepVal;
    sleepHours.push(sleepVal);

    // Ages: male target avg = 15.95, female target avg = 15.91
    let ageVal = isMale
      ? 15.95 + (Math.random() * 6 - 3)
      : 15.91 + (Math.random() * 6 - 3);
    ageVal = Math.max(13, Math.min(19, Math.round(ageVal)));
    if (isMale) maleAgeSum += ageVal;
    else femaleAgeSum += ageVal;
    ages.push(ageVal);
  }

  // Adjust sleep hours to match sums exactly
  const maleIndices = genders.map((g, idx) => g === 'male' ? idx : -1).filter(idx => idx !== -1);
  const femaleIndices = genders.map((g, idx) => g === 'female' ? idx : -1).filter(idx => idx !== -1);

  // Adjust male sleep (target sum = 3936.0)
  let maleSleepDiff = 3936.0 - maleSleepSum;
  while (Math.abs(maleSleepDiff) > 0.05) {
    const idx = maleIndices[Math.floor(Math.random() * maleIndices.length)];
    const delta = maleSleepDiff > 0 ? 0.1 : -0.1;
    sleepHours[idx] = Math.round((sleepHours[idx] + delta) * 10) / 10;
    maleSleepSum += delta;
    maleSleepDiff = 3936.0 - maleSleepSum;
  }

  // Adjust female sleep (target sum = 3802.5)
  let femaleSleepDiff = 3802.5 - femaleSleepSum;
  while (Math.abs(femaleSleepDiff) > 0.05) {
    const idx = femaleIndices[Math.floor(Math.random() * femaleIndices.length)];
    const delta = femaleSleepDiff > 0 ? 0.1 : -0.1;
    sleepHours[idx] = Math.round((sleepHours[idx] + delta) * 10) / 10;
    femaleSleepSum += delta;
    femaleSleepDiff = 3802.5 - femaleSleepSum;
  }

  // Adjust male ages (target sum = 9810)
  let maleAgeDiff = 9810 - maleAgeSum;
  while (maleAgeDiff !== 0) {
    const idx = maleIndices[Math.floor(Math.random() * maleIndices.length)];
    const delta = maleAgeDiff > 0 ? 1 : -1;
    const newVal = ages[idx] + delta;
    if (newVal >= 13 && newVal <= 19) {
      ages[idx] = newVal;
      maleAgeSum += delta;
      maleAgeDiff = 9810 - maleAgeSum;
    }
  }

  // Adjust female ages (target sum = 9307)
  let femaleAgeDiff = 9307 - femaleAgeSum;
  while (femaleAgeDiff !== 0) {
    const idx = femaleIndices[Math.floor(Math.random() * femaleIndices.length)];
    const delta = femaleAgeDiff > 0 ? 1 : -1;
    const newVal = ages[idx] + delta;
    if (newVal >= 13 && newVal <= 19) {
      ages[idx] = newVal;
      femaleAgeSum += delta;
      femaleAgeDiff = 9307 - femaleAgeSum;
    }
  }

  // Screen time slots and stress levels: avg stress = 5.1 (sum = 6120)
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

  const stressLevels: number[] = [];
  let stressSum = 0;

  for (let i = 0; i < 1200; i++) {
    const st = screenTimeSlots[i];
    const baseStress = 3.0 + (st / 3.0) * 3.6; // average stress varies from 3.0 to 6.6
    let stressVal = Math.round(baseStress + (Math.random() * 4 - 2));
    stressVal = Math.max(1, Math.min(10, stressVal));
    stressLevels.push(stressVal);
    stressSum += stressVal;
  }

  // Adjust stress sum to exactly 6120
  let stressDiff = 6120 - stressSum;
  while (stressDiff !== 0) {
    const idx = Math.floor(Math.random() * 1200);
    const delta = stressDiff > 0 ? 1 : -1;
    const newVal = stressLevels[idx] + delta;
    if (newVal >= 1 && newVal <= 10) {
      stressLevels[idx] = newVal;
      stressSum += delta;
      stressDiff = 6120 - stressSum;
    }
  }

  // Depression Labels: correlated with stress and anxiety
  const depressionLabels: string[] = [];
  for (let i = 0; i < 1200; i++) {
    const score = (stressLevels[i] + anxietyLevels[i]) / 2;
    let label = 'Moderate';
    if (score <= 2.5) label = 'Low';
    else if (score <= 4.5) label = 'Mild';
    else if (score <= 6.5) label = 'Moderate';
    else if (score <= 8.5) label = 'High';
    else label = 'Severe';
    depressionLabels.push(label);
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
      screen_time_before_sleep: screenTimeSlots[i],
      depression_label: depressionLabels[i]
    });
  }

  const csvStr = sampleData.map(r => Object.values(r).join(',')).join('\n');
  const csvHeader = Object.keys(sampleData[0]).join(',') + '\n' + csvStr;
  return csvHeader;
}
