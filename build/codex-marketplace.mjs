// build/codex-marketplace.mjs
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { buildCodexPlugin } from './codex-plugin.mjs';

const REPO = process.cwd();
const OUT = resolve(REPO, 'dist/codex-marketplace');
const PLUGIN_NAME = 'kanbots-skill';

function buildMarketplace() {
  return {
    name: PLUGIN_NAME,
    interface: {
      displayName: 'Kanbots',
    },
    plugins: [
      {
        name: PLUGIN_NAME,
        source: {
          source: 'local',
          path: `./plugins/${PLUGIN_NAME}`,
        },
        policy: {
          installation: 'AVAILABLE',
          authentication: 'ON_INSTALL',
        },
        category: 'Productivity',
      },
    ],
  };
}

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  await buildCodexPlugin({ out: join(OUT, 'plugins', PLUGIN_NAME) });

  const marketplacePath = join(OUT, '.agents/plugins/marketplace.json');
  await mkdir(join(OUT, '.agents/plugins'), { recursive: true });
  await writeFile(marketplacePath, JSON.stringify(buildMarketplace(), null, 2) + '\n');

  console.log(`[codex-marketplace] emitted ${relative(REPO, OUT)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
