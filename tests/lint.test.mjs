import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';

describe('lint stub', () => {
  it('exits 0 when run via npm script', () => {
    const out = execSync('npm run lint --silent', { encoding: 'utf8' });
    expect(out).toMatch(/lint/);
  });
});
