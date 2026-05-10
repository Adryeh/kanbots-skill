// build/portable.mjs
import { rm, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { existsSync } from 'node:fs';
import matter from 'gray-matter';
import { lintAll, expandIncludes, BuildError } from './shared.mjs';

const REPO = process.cwd();
const SRC = resolve(REPO, 'src');
const OUT = resolve(REPO, 'dist/skill');
const REPO_URL = 'https://github.com/Adryeh/kanbots-skill';

const args = new Set(process.argv.slice(2));
const inlineCore = [...args].some(a => a === '--inline=core');

async function readPkg() {
  return JSON.parse(await readFile('package.json', 'utf8'));
}

function rewriteLinks(body, version) {
  // [text](references/x.md) → [text](<repo>/blob/v<version>/src/references/x.md)
  return body.replace(
    /\]\(references\/([^)]+\.md)\)/g,
    `](${REPO_URL}/blob/v${version}/src/references/$1)`
  );
}

async function loadReferenceBody(name) {
  const abs = join(SRC, 'references', name);
  if (!existsSync(abs)) throw new BuildError(`references/${name}`, 'missing for inline');
  const parsed = matter(await readFile(abs, 'utf8'));
  return parsed.content.trim();
}

async function inlineCoreSections(body) {
  const mutations = await loadReferenceBody('mutations.md');
  const errors = await loadReferenceBody('errors.md');
  return [
    body.trim(),
    '## Inlined: mutations',
    mutations,
    '## Inlined: errors',
    errors,
  ].join('\n\n');
}

async function main() {
  const { errors } = await lintAll();
  if (errors.length) {
    for (const e of errors) console.error(`[portable] ${e}`);
    process.exit(1);
  }

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const pkg = await readPkg();
  const skillSrcAbs = join(SRC, 'skill.md');
  if (!existsSync(skillSrcAbs)) {
    console.log('[portable] src/skill.md not present yet — skipping content emit');
    process.exit(0);
  }
  const raw = await readFile(skillSrcAbs, 'utf8');
  const parsed = matter(raw);
  const expanded = await expandIncludes(parsed.content);

  let body = inlineCore ? await inlineCoreSections(expanded) : expanded;
  body = rewriteLinks(body, pkg.version);

  const out = matter.stringify(body, parsed.data);
  await writeFile(join(OUT, 'SKILL.md'), out);

  const readme = [
    '# kanban-for-agents (portable)',
    '',
    `Version: ${pkg.version}`,
    '',
    'Drop `SKILL.md` into your agent\'s skills directory.',
    'Detailed references are linked back to GitHub at this version.',
    inlineCore ? 'This build inlines the most-cited references for offline agents.' : '',
  ].filter(Boolean).join('\n');
  await writeFile(join(OUT, 'README.md'), readme);

  console.log(`[portable] emitted ${relative(REPO, OUT)}${inlineCore ? ' (inline=core)' : ''}`);
}

main().catch((e) => {
  console.error(e instanceof BuildError ? `[portable] ${e.message}` : e);
  process.exit(1);
});
