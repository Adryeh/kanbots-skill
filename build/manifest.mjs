// build/manifest.mjs
import { readFile } from 'node:fs/promises';

export async function buildPluginManifest({ pkgPath = 'package.json', enabledHooks = [] } = {}) {
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
  return {
    name: 'kanbots-skill',
    version: pkg.version,
    description: pkg.description,
    license: pkg.license,
    repository: pkg.repository?.url ?? null,
    hooks: enabledHooks.map(h => ({
      name: h.name,
      type: h.type,
      matcher: h.matcher ?? null,
      command: h.command,
    })),
  };
}
