const fs = require('node:fs');
const path = require('node:path');
const files = [
  ['app/api/rnd/worker/claim/route.ts', /const MAX_RND_ATTEMPTS = 5;/, 'claim route must enforce a five-attempt ceiling'],
  ['app/api/rnd/worker/report/route.ts', /const MAX_RND_ATTEMPTS = 5;/, 'report route must enforce a five-attempt ceiling'],
];
for (const [file, pattern, message] of files) {
  const source = fs.readFileSync(file, 'utf8');
  if (!pattern.test(source)) throw new Error(message);
  if (file.includes('/claim/')) {
    if (!/attemptCount:\s*\{\s*lt:\s*MAX_RND_ATTEMPTS\s*\}/.test(source)) throw new Error('claim route must reject jobs already at the ceiling');
    if (!/attemptCount:\s*\{\s*gte:\s*MAX_RND_ATTEMPTS\s*\}/.test(source)) throw new Error('claim route must terminalize exhausted jobs');
  } else {
    if (!/if \(attemptNumber > MAX_RND_ATTEMPTS\)/.test(source)) throw new Error('report route must reject reports beyond the ceiling');
    if (!/status: "FAILED"[\s\S]*failureCode: "RND_CONVERGENCE_LIMIT"/.test(source)) throw new Error('report route must terminalize an over-limit attempt');
  }
}
const readme = fs.readFileSync('tools/rnd-worker/README.md', 'utf8');
if (!/ceiling is 5 attempts/.test(readme)) throw new Error('worker README must document five attempts');
if (/ceiling is 40 attempts/.test(readme)) throw new Error('stale 40-attempt documentation remains');
console.log('PASS: claim/report enforce the five-attempt ceiling and terminalize exhausted jobs; worker documentation agrees.');

