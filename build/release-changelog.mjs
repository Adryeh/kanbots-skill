// build/release-changelog.mjs
import { readFile } from 'node:fs/promises';

export function extractChangelogBody(changelog, version) {
  const normalized = version.replace(/^v/, '');
  const heading = `## [${normalized}]`;
  const lines = changelog.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith(heading));

  if (start === -1) {
    throw new Error(`CHANGELOG.md does not contain ${heading}`);
  }

  const body = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('## ')) break;
    body.push(line);
  }

  return body.join('\n').trim() + '\n';
}

async function main() {
  const [version, changelogPath = 'CHANGELOG.md'] = process.argv.slice(2);
  if (!version) {
    console.error('usage: node build/release-changelog.mjs <version-or-tag> [CHANGELOG.md]');
    process.exit(2);
  }

  const changelog = await readFile(changelogPath, 'utf8');
  process.stdout.write(extractChangelogBody(changelog, version));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
