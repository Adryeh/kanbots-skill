// build/manifest.mjs
import { readFile } from 'node:fs/promises';

function groupHooks(enabledHooks) {
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
