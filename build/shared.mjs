// build/shared.mjs
import { readdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { argv, exit, cwd } from 'node:process';
import matter from 'gray-matter';
import { z } from 'zod';

const REPO_ROOT = cwd();
const SRC_DIR = resolve(REPO_ROOT, 'src');

export class BuildError extends Error {
  constructor(file, message) {
    super(`${file}: ${message}`);
    this.file = file;
  }
}

// --- Schemas ---

const skillFrontmatterSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1).max(1024),
}).passthrough();

const commandFrontmatterSchema = z.object({
  description: z.string().min(1),
  'argument-hint': z.string().optional(),
}).passthrough();

const agentFrontmatterSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  model: z.enum(['haiku', 'sonnet', 'opus']).optional(),
  tools: z.array(z.string()).optional(),
}).passthrough();

const referenceFrontmatterSchema = z.object({
  description: z.string().min(1).optional(),
}).passthrough();

const PLACEHOLDER_RE = /\b(TODO|FIXME|TBD|PLACEHOLDER|XXX)\b/;
const INCLUDE_RE = /<!--\s*include:\s*([^\s]+)\s*-->/g;
const INCLUDE_RE_SINGLE = /<!--\s*include:\s*([^\s]+)\s*-->/;
const REL_LINK_RE = /\]\((references\/[^)]+\.md)\)/g;

// --- Walk + classify ---

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(full));
    else out.push(full);
  }
  return out;
}

function classify(srcRelPath) {
  if (srcRelPath === 'skill.md') return 'skill';
  if (srcRelPath.startsWith('references/')) return 'reference';
  if (srcRelPath.startsWith('commands/')) return 'command';
  if (srcRelPath.startsWith('agents/')) return 'agent';
  if (srcRelPath.startsWith('shared/')) return 'shared';
  if (srcRelPath.startsWith('hooks/')) return 'hook';
  if (srcRelPath.startsWith('scripts/')) return 'script';
  return 'other';
}

// --- Parse + validate one file ---

export async function loadMarkdown(absPath) {
  const raw = await readFile(absPath, 'utf8');
  const parsed = matter(raw);
  return { frontmatter: parsed.data, body: parsed.content, raw };
}

export async function lintMarkdownFile(absPath) {
  const rel = relative(SRC_DIR, absPath);
  const kind = classify(rel);

  const { frontmatter, body, raw } = await loadMarkdown(absPath);

  // Frontmatter schema by kind
  switch (kind) {
    case 'skill':
      skillFrontmatterSchema.parse(frontmatter);
      break;
    case 'command':
      commandFrontmatterSchema.parse(frontmatter);
      break;
    case 'agent':
      agentFrontmatterSchema.parse(frontmatter);
      break;
    case 'reference':
    case 'shared':
      referenceFrontmatterSchema.parse(frontmatter);
      break;
    default:
      // hooks/scripts/other markdown not handled here
      break;
  }

  // Placeholder scan (only on file body)
  if (PLACEHOLDER_RE.test(body)) {
    throw new BuildError(rel, `placeholder marker (TODO/FIXME/TBD/PLACEHOLDER/XXX) in body`);
  }

  // Include directive: target must exist under src/
  const includes = [...body.matchAll(INCLUDE_RE)].map(m => m[1]);
  for (const target of includes) {
    const abs = resolve(SRC_DIR, target);
    if (!abs.startsWith(SRC_DIR + '/') && abs !== SRC_DIR) {
      throw new BuildError(rel, `include target escapes src/: ${target}`);
    }
    if (!existsSync(abs)) {
      throw new BuildError(rel, `include target does not exist: ${target}`);
    }
  }

  // Relative reference links: must exist (and stay within src/)
  const links = [...body.matchAll(REL_LINK_RE)].map(m => m[1]);
  for (const target of links) {
    const abs = resolve(SRC_DIR, target);
    if (!abs.startsWith(SRC_DIR + '/') && abs !== SRC_DIR) {
      throw new BuildError(rel, `link target escapes src/: ${target}`);
    }
    if (!existsSync(abs)) {
      throw new BuildError(rel, `internal link points to missing file: ${target}`);
    }
  }

  return { kind, frontmatter, body, raw, rel };
}

// --- Public: lint whole src/ ---

export async function lintAll(srcDir = SRC_DIR) {
  const files = await walk(srcDir);
  const mdFiles = files.filter(f => f.endsWith('.md'));
  const errors = [];
  const results = [];
  for (const f of mdFiles) {
    try {
      results.push(await lintMarkdownFile(f));
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return { results, errors };
}

export async function expandIncludes(body) {
  let out = body;
  const matches = [...body.matchAll(INCLUDE_RE)];
  for (const m of matches) {
    const target = m[1];
    const abs = resolve(SRC_DIR, target);
    const raw = await readFile(abs, 'utf8');
    const parsed = matter(raw);
    if (INCLUDE_RE_SINGLE.test(parsed.content)) {
      throw new BuildError(target, 'nested include detected; recursion forbidden');
    }
    out = out.replace(m[0], parsed.content.trim());
  }
  return out;
}

// --- CLI entry ---

async function main() {
  const args = new Set(argv.slice(2));
  if (!args.has('--lint-only')) {
    console.error('build/shared.mjs CLI: only --lint-only is supported');
    exit(2);
  }
  // src/ may not exist yet on a fresh repo; treat as success.
  try {
    await stat(SRC_DIR);
  } catch {
    console.log('[lint] src/ does not exist yet — nothing to lint');
    exit(0);
  }
  const { results, errors } = await lintAll();
  if (errors.length) {
    for (const e of errors) console.error(`[lint] ${e}`);
    console.error(`[lint] ${errors.length} error(s) in ${results.length + errors.length} file(s)`);
    exit(1);
  }
  console.log(`[lint] ok — ${results.length} file(s)`);
  exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
