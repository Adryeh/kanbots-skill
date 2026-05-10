import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';

describe('build pipeline against minimal src/', () => {
  it('plugin build emits expected files', () => {
    // We test against the real repo cwd, using a minimal src/ scaffolded just for this test.
    const skillDir = 'src';
    const created = !existsSync(skillDir);
    if (created) mkdirSync(skillDir);

    const skillFile = 'src/skill.md';
    const fileCreated = !existsSync(skillFile);
    if (fileCreated) {
      writeFileSync(
        skillFile,
        '---\nname: kanban-for-agents\ndescription: test stub.\n---\n\nbody.\n'
      );
    }

    try {
      execSync('node build/plugin.mjs', { stdio: 'pipe' });
      expect(existsSync('dist/plugin/.claude-plugin/plugin.json')).toBe(true);
      expect(existsSync('dist/plugin/skills/kanban-for-agents/SKILL.md')).toBe(true);
    } finally {
      if (fileCreated) rmSync(skillFile);
      if (created) rmSync(skillDir, { recursive: true });
      rmSync('dist', { recursive: true, force: true });
    }
  });
});
