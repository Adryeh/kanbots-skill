// build/plugin.mjs
import { rm, mkdir, readdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, relative, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import matter from 'gray-matter';
import { lintAll, expandIncludes, BuildError } from './shared.mjs';
import { buildPluginManifest } from './manifest.mjs';

const REPO = process.cwd();
const SRC = resolve(REPO, 'src');
const OUT = resolve(REPO, 'dist/plugin');

const ENABLED_HOOKS = [
  {
    name: 'enforce-agent-name',
    type: 'PreToolUse',
    matcher: 'mcp__kanban__.*',
    command: 'python3 ${CLAUDE_PLUGIN_ROOT}/hooks/enforce-agent-name.py',
  },
  {
    name: 'auto-extend-claim',
    type: 'PreToolUse',
    matcher: 'mcp__kanban__.*',
    command: 'python3 ${CLAUDE_PLUGIN_ROOT}/hooks/auto-extend-claim.py',
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

async function main() {
  // 1) Lint first
  const { errors } = await lintAll();
  if (errors.length) {
    for (const e of errors) console.error(`[plugin] ${e}`);
    process.exit(1);
  }

  // 2) Clean
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  // 3) skill + references
  const skillDst = join(OUT, 'skills/kanban-for-agents');
  await emitMarkdownWithIncludes(join(SRC, 'skill.md'), join(skillDst, 'SKILL.md'));
  await emitTreeWithIncludes(join(SRC, 'references'), join(skillDst, 'references'));

  // 4) commands + agents
  await emitTreeWithIncludes(join(SRC, 'commands'), join(OUT, 'commands'));
  await emitTreeWithIncludes(join(SRC, 'agents'), join(OUT, 'agents'));

  // 5) hooks (verbatim copy — all 4)
  await copyDir(join(SRC, 'hooks'), join(OUT, 'hooks'));

  // 6) manifest
  const manifest = await buildPluginManifest({ enabledHooks: ENABLED_HOOKS });
  await mkdir(join(OUT, '.claude-plugin'), { recursive: true });
  await writeFile(
    join(OUT, '.claude-plugin/plugin.json'),
    JSON.stringify(manifest, null, 2) + '\n'
  );

  console.log(`[plugin] emitted ${relative(REPO, OUT)}`);
}

main().catch((e) => {
  console.error(e instanceof BuildError ? `[plugin] ${e.message}` : e);
  process.exit(1);
});
