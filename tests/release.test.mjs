import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { extractChangelogBody } from '../build/release-changelog.mjs';

describe('release changelog extraction', () => {
  it('extracts the requested version section with literal bracket headings', () => {
    const changelog = readFileSync('CHANGELOG.md', 'utf8');
    const body = extractChangelogBody(changelog, '0.2.0');

    expect(body).toContain('Codex plugin build output');
    expect(body).toContain('Codex marketplace build output');
    expect(body).not.toContain('Release pipeline: rebuild `dist/`');
  });
});
