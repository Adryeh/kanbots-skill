import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';

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

  it('codex plugin build emits expected files and metadata', () => {
    try {
      execSync('node build/codex-plugin.mjs', { stdio: 'pipe' });

      expect(existsSync('dist/codex-plugin/.codex-plugin/plugin.json')).toBe(true);
      expect(existsSync('dist/codex-plugin/skills/kanban-for-agents/SKILL.md')).toBe(true);
      expect(existsSync('dist/codex-plugin/commands/kanban-pickup.md')).toBe(true);
      expect(existsSync('dist/codex-plugin/agents/kanban-worker.md')).toBe(true);
      expect(existsSync('dist/codex-plugin/hooks.json')).toBe(true);

      const manifest = JSON.parse(
        readFileSync('dist/codex-plugin/.codex-plugin/plugin.json', 'utf8')
      );
      expect(manifest.name).toBe('kanbots-skill');
      expect(manifest.skills).toBe('./skills/');
      expect(manifest.hooks).toBe('./hooks.json');
      expect(manifest.interface.displayName).toBe('Kanbots');

      const hooks = JSON.parse(readFileSync('dist/codex-plugin/hooks.json', 'utf8'));
      const commands = hooks.hooks.PreToolUse.flatMap((entry) =>
        entry.hooks.map((hook) => hook.command)
      );
      expect(commands).toContain('python3 ./hooks/enforce-agent-name.py');
      expect(commands).toContain('python3 ./hooks/auto-extend-claim.py');
      expect(commands.every((command) => !command.includes('CLAUDE_PLUGIN_ROOT'))).toBe(true);
    } finally {
      rmSync('dist/codex-plugin', { recursive: true, force: true });
    }
  });

  it('codex marketplace build emits an installable marketplace root', () => {
    try {
      execSync('node build/codex-marketplace.mjs', { stdio: 'pipe' });

      expect(existsSync('dist/codex-marketplace/.agents/plugins/marketplace.json')).toBe(true);
      expect(
        existsSync('dist/codex-marketplace/plugins/kanbots-skill/.codex-plugin/plugin.json')
      ).toBe(true);
      expect(
        existsSync('dist/codex-marketplace/plugins/kanbots-skill/skills/kanban-for-agents/SKILL.md')
      ).toBe(true);
      expect(existsSync('dist/codex-marketplace/plugins/kanbots-skill/hooks.json')).toBe(true);

      const marketplace = JSON.parse(
        readFileSync('dist/codex-marketplace/.agents/plugins/marketplace.json', 'utf8')
      );
      expect(marketplace.name).toBe('kanbots-skill');
      expect(marketplace.interface.displayName).toBe('Kanbots');
      expect(marketplace.plugins).toEqual([
        {
          name: 'kanbots-skill',
          source: {
            source: 'local',
            path: './plugins/kanbots-skill',
          },
          policy: {
            installation: 'AVAILABLE',
            authentication: 'ON_INSTALL',
          },
          category: 'Productivity',
        },
      ]);
    } finally {
      rmSync('dist/codex-marketplace', { recursive: true, force: true });
    }
  });
});
