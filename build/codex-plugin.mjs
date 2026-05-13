// build/codex-plugin.mjs
import { rm, mkdir, readdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, relative, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import matter from 'gray-matter';
import { lintAll, expandIncludes, BuildError } from './shared.mjs';
import { buildCodexPluginManifest, buildHooksConfig } from './manifest.mjs';

const REPO = process.cwd();
const SRC = resolve(REPO, 'src');
const OUT = resolve(REPO, 'dist/codex-plugin');

const ENABLED_HOOKS = [
  {
    name: 'enforce-agent-name',
    type: 'PreToolUse',
    matcher: 'mcp__kanban__.*',
    command: 'python3 ./hooks/enforce-agent-name.py',
  },
  {
    name: 'auto-extend-claim',
    type: 'PreToolUse',
    matcher: 'mcp__kanban__.*',
    command: 'python3 ./hooks/auto-extend-claim.py',
  },
];

async function copyDir(src, dst) {
  if (!existsSync(src)) return;
  await mkdir(dst, { recursive: true });
  for (const e of await readdir(src, { withFileTypes: true })) {
    const s = join(src, e.name);
    const d = join(dst, e.name);
    if (e.isDirectory()) await copyDir(s, d);
    else await copyFile(s, d);
  }
}

async function emitMarkdownWithIncludes(absSrc, absDst) {
  const raw = await readFile(absSrc, 'utf8');
  const parsed = matter(raw);
  const expanded = await expandIncludes(parsed.content);
  const output = matter.stringify(expanded, parsed.data);
  await mkdir(dirname(absDst), { recursive: true });
  await writeFile(absDst, output);
}

async function emitTreeWithIncludes(srcDir, dstDir) {
  if (!existsSync(srcDir)) return;
  for (const e of await readdir(srcDir, { withFileTypes: true })) {
    const s = join(srcDir, e.name);
    const d = join(dstDir, e.name);
    if (e.isDirectory()) await emitTreeWithIncludes(s, d);
    else if (e.name.endsWith('.md')) await emitMarkdownWithIncludes(s, d);
    else {
      await mkdir(dirname(d), { recursive: true });
      await copyFile(s, d);
    }
  }
}

export async function buildCodexPlugin({ out = OUT } = {}) {
  const { errors } = await lintAll();
  if (errors.length) {
    for (const e of errors) console.error(`[codex-plugin] ${e}`);
    process.exit(1);
  }

  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });

  const skillDst = join(out, 'skills/kanban-for-agents');
  await emitMarkdownWithIncludes(join(SRC, 'skill.md'), join(skillDst, 'SKILL.md'));
  await emitTreeWithIncludes(join(SRC, 'references'), join(skillDst, 'references'));

  await emitTreeWithIncludes(join(SRC, 'commands'), join(out, 'commands'));
  await emitTreeWithIncludes(join(SRC, 'agents'), join(out, 'agents'));
  await copyDir(join(SRC, 'hooks'), join(out, 'hooks'));
  await copyDir(join(SRC, 'scripts'), join(out, 'scripts'));

  const manifest = await buildCodexPluginManifest();
  await mkdir(join(out, '.codex-plugin'), { recursive: true });
  await writeFile(
    join(out, '.codex-plugin/plugin.json'),
    JSON.stringify(manifest, null, 2) + '\n'
  );
  await writeFile(
    join(out, 'hooks.json'),
    JSON.stringify(buildHooksConfig({ enabledHooks: ENABLED_HOOKS }), null, 2) + '\n'
  );

  console.log(`[codex-plugin] emitted ${relative(REPO, out)}`);
}

async function main() {
  await buildCodexPlugin();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e instanceof BuildError ? `[codex-plugin] ${e.message}` : e);
    process.exit(1);
  });
}
