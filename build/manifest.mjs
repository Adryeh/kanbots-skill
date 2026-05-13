// build/manifest.mjs
import { readFile } from 'node:fs/promises';

export function groupHooks(enabledHooks) {
  // Claude Code plugin.json expects: { hooks: { <Event>: [ { matcher, hooks: [ { type: "command", command } ] } ] } }
  const byEvent = {};
  for (const h of enabledHooks) {
    const event = h.type;
    const matcher = h.matcher ?? '';
    byEvent[event] ??= new Map();
    const bucket = byEvent[event].get(matcher) ?? [];
    bucket.push({ type: 'command', command: h.command });
    byEvent[event].set(matcher, bucket);
  }
  const out = {};
  for (const [event, map] of Object.entries(byEvent)) {
    out[event] = [...map.entries()].map(([matcher, hooks]) => ({ matcher, hooks }));
  }
  return out;
}

export function buildHooksConfig({ enabledHooks = [] } = {}) {
  return {
    hooks: groupHooks(enabledHooks),
  };
}

function cleanRepositoryUrl(url) {
  if (!url) return null;
  return url.replace(/^git\+/, '').replace(/\.git$/, '');
}

export async function buildPluginManifest({ pkgPath = 'package.json', enabledHooks = [] } = {}) {
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
  return {
    name: 'kanbots-skill',
    version: pkg.version,
    description: pkg.description,
    license: pkg.license,
    repository: pkg.repository?.url ?? null,
    hooks: groupHooks(enabledHooks),
  };
}

export async function buildCodexPluginManifest({ pkgPath = 'package.json' } = {}) {
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
  const repository = cleanRepositoryUrl(pkg.repository?.url);
  return {
    name: 'kanbots-skill',
    version: pkg.version,
    description: pkg.description,
    author: {
      name: 'Adryeh',
      url: 'https://github.com/Adryeh',
    },
    homepage: 'https://docs.kanbots.ru/agents/setup',
    repository,
    license: pkg.license,
    keywords: [
      'kanban',
      'kanbots',
      'mcp',
      'agents',
      'coordination',
      'tasks',
    ],
    skills: './skills/',
    hooks: './hooks.json',
    interface: {
      displayName: 'Kanbots',
      shortDescription: 'Kanban workflows for coordinated coding agents',
      longDescription: (
        'Use Kanbots to coordinate Codex agents on a shared kanban board with task claims, '
        + 'optimistic concurrency, progress reporting, and recovery guidance for common MCP errors.'
      ),
      developerName: 'Adryeh',
      category: 'Productivity',
      capabilities: ['Interactive', 'Read', 'Write'],
      websiteURL: 'https://kanbots.ru',
      defaultPrompt: [
        'Use Kanbots to pick up my next task',
        'Split this work into Kanbots subtasks',
        'Check my Kanbots board status',
      ],
      brandColor: '#2563EB',
      screenshots: [],
    },
  };
}
