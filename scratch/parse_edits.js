const fs = require('fs');
const path = require('path');

const logPath = 'C:\\Users\\dell\\.gemini\\antigravity\\brain\\efdc88d5-780f-4d69-b4eb-a6c643b3bd37\\.system_generated\\logs\\transcript.jsonl';
if (!fs.existsSync(logPath)) {
  console.error('Log file does not exist at ' + logPath);
  process.exit(1);
}

const fileStream = fs.createReadStream(logPath);
const readline = require('readline');

const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity
});

let toolCalls = [];

rl.on('line', (line) => {
  try {
    const step = JSON.parse(line);
    if (step.tool_calls) {
      for (const call of step.tool_calls) {
        const name = call.name || call.ToolName || '';
        const args = call.args || call.Arguments || {};
        const target = args.TargetFile || args.AbsolutePath || '';
        if (target.endsWith('AnalyzePage.tsx')) {
          toolCalls.push({
            step_index: step.step_index,
            type: step.type,
            name: name,
            target: target,
            args: args,
            status: step.status
          });
        }
      }
    }
  } catch (err) {
    // Ignore invalid JSON lines
  }
});

rl.on('close', () => {
  console.log(`Found ${toolCalls.length} tool calls modifying/viewing AnalyzePage.tsx.`);
  toolCalls.forEach((tc, i) => {
    console.log(`[${i}] Step: ${tc.step_index} | Type: ${tc.type} | Tool: ${tc.name} | Status: ${tc.status}`);
    if (tc.name === 'replace_file_content' || tc.name === 'multi_replace_file_content') {
      console.log(`  Instruction: ${tc.args.Instruction}`);
    }
  });
});
