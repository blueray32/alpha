#!/usr/bin/env node
import { ValidationRunner } from '../lib/validation-runner.js';
import { parseArgs } from 'util';

const { values } = parseArgs({
  options: {
    flow: {
      type: 'string',
      short: 'f',
    },
    env: {
      type: 'string',
      short: 'e',
      multiple: true,
    },
  },
});

if (!values.flow) {
  console.error('Usage: tsx src/cli/validate.ts --flow <flow-path> [--env KEY=VALUE ...]');
  process.exit(1);
}

const env: Record<string, string> = {};
if (values.env) {
  for (const pair of values.env) {
    const [key, value] = pair.split('=');
    if (key && value) {
      env[key] = value;
    }
  }
}

const runner = new ValidationRunner();
const result = await runner.runFlow(values.flow, env);

console.log('\n📋 Validation Result:');
console.log(`   Flow: ${result.flowName}`);
console.log(`   Status: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
console.log(`   Steps: ${result.completedSteps}/${result.steps}`);
console.log(`   Duration: ${result.duration_ms}ms`);

if (result.screenshots.length > 0) {
  console.log(`   Screenshots: ${result.screenshots.join(', ')}`);
}

if (result.error) {
  console.error(`\n❌ Error: ${result.error}`);
}

await runner.cleanup();
process.exit(result.success ? 0 : 1);
