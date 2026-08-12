const fs = require('fs');
const readline = require('readline');

const logPath = 'C:\\Users\\dell\\.gemini\\antigravity\\brain\\efdc88d5-780f-4d69-b4eb-a6c643b3bd37\\.system_generated\\logs\\transcript.jsonl';
const fileStream = fs.createReadStream(logPath);
const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  try {
    const step = JSON.parse(line);
    if (step.step_index === 1633) {
      console.log('FOUND STEP 1633!');
      const call = step.tool_calls[0];
      const args = call.args || call.Arguments || {};
      
      const cleanStr = (s) => {
        if (typeof s !== 'string') return '';
        let res = s.trim();
        if (res.startsWith('"') && res.endsWith('"')) res = res.slice(1, -1);
        return res;
      };

      const replacement = cleanStr(args.ReplacementContent);
      const target = cleanStr(args.TargetContent);
      console.log('Target length:', target.length);
      console.log('Replacement length:', replacement.length);
      
      fs.writeFileSync('scratch/step_1633_target.txt', target);
      fs.writeFileSync('scratch/step_1633_replacement.txt', replacement);
      console.log('Wrote targets/replacements to scratch folder.');
    }
  } catch (e) {
    console.error('Error parsing line:', e);
  }
});
