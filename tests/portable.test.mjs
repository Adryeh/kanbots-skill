// tests/portable.test.mjs
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync, rmSync } from 'node:fs';

function runBuild(args = []) {
  execSync(['node', 'build/portable.mjs', ...args].join(' '), { stdio: 'pipe' });
}

describe('portable build', () => {
  it('default rewrites references/ links to GitHub URLs', () => {
    rmSync('dist/skill', { recursive: true, force: true });
    runBuild();
    const md = readFileSync('dist/skill/SKILL.md', 'utf8');
    expect(md).toMatch(/github\.com\/Adryeh\/kanbots-skill\/blob\/v\d+\.\d+\.\d+\/src\/references\//);
    expect(md).not.toMatch(/\]\(references\//);
  });

  it('--inline=core inlines mutations and errors content', () => {
    rmSync('dist/skill', { recursive: true, force: true });
    runBuild(['--inline=core']);
    const md = readFileSync('dist/skill/SKILL.md', 'utf8');
    expect(md).toMatch(/## Inlined: mutations/);
    expect(md).toMatch(/## Inlined: errors/);
  });
});
