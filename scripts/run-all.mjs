import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const entries = await readdir(here);
const suites = entries
  .filter(name => name.startsWith('test-') && name.endsWith('.mjs'))
  .sort();

const runSuite = name =>
  new Promise(resolve => {
    const child = spawn(process.execPath, [join(here, name)], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    let output = '';
    child.stdout.on('data', chunk => (output += chunk));
    child.stderr.on('data', chunk => (output += chunk));
    child.on('close', code => resolve({ name, code, output }));
  });

const results = [];
for (const name of suites) {
  const result = await runSuite(name);
  const summary = result.output.match(/(\d+) passed, (\d+) failed/);
  const passed = Number(summary?.[1] ?? 0);
  const failed = Number(summary?.[2] ?? 0);

  results.push({ ...result, passed, failed });
  const status = result.code === 0 && failed === 0 ? 'ok  ' : 'FAIL';
  console.log(`${status} ${name.padEnd(36)} ${passed} passed, ${failed} failed`);
}

const broken = results.filter(result => result.code !== 0 || result.failed > 0);
const totalPassed = results.reduce((sum, result) => sum + result.passed, 0);
const totalFailed = results.reduce((sum, result) => sum + result.failed, 0);

console.log(
  `\n${suites.length} suites — ${totalPassed} passed, ${totalFailed} failed`,
);

if (broken.length) {
  for (const result of broken) {
    console.log(`\n===== ${result.name} =====\n${result.output}`);
  }
  process.exit(1);
}
