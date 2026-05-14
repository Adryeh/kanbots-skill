// build/claude-marketplace.mjs
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { buildClaudePlugin } from './plugin.mjs';

const REPO = process.cwd();
const OUT = resolve(REPO, 'dist/claude-marketplace');
const PLUGIN_NAME = 'kanbots-skill';

async function buildMarketplace() {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  return {
    name: PLUGIN_NAME,
    owner: { name: 'Adryeh' },
    plugins: [
      {
        name: PLUGIN_NAME,
        source: `./plugins/${PLUGIN_NAME}`,
        description: pkg.description,
        version: pkg.version,
        category: 'Productivity',
        homepage: 'https://docs.kanbots.ru/agents/setup',
        license: pkg.license,
      },
    ],
  };
}

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  await buildClaudePlugin({ out: join(OUT, 'plugins', PLUGIN_NAME) });

  const marketplace = await buildMarketplace();
  await mkdir(join(OUT, '.claude-plugin'), { recursive: true });
  await writeFile(
    join(OUT, '.claude-plugin/marketplace.json'),
    JSON.stringify(marketplace, null, 2) + '\n'
  );

  console.log(`[claude-marketplace] emitted ${relative(REPO, OUT)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
