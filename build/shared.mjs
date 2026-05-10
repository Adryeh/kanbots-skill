// build/shared.mjs
// Entry point: invoked by `npm run lint` with --lint-only
// Full implementation lands in Task 5.

import { argv, exit } from 'node:process';

const args = new Set(argv.slice(2));
const lintOnly = args.has('--lint-only');

if (lintOnly) {
  console.log('[lint] stub — implementation arriving in Task 5');
  exit(0);
}

console.error('build/shared.mjs is a library; nothing to do.');
exit(2);
