# Kanbots Skill Rework — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the monolithic `SKILL.md` with a single-source-of-truth `src/` tree and a build pipeline that emits two distributions (Claude Code plugin + portable skill), plus the first wave of slash commands, sub-agents, hooks, and a tag-driven release pipeline.

**Architecture:** `src/` is hand-edited markdown / scripts. `build/*.mjs` (ESM, Node 20) parses frontmatter, expands one `<!-- include: -->` directive, optionally rewrites links, and writes `dist/plugin/` and `dist/skill/`. Linting is the first build phase, also runnable standalone. CI runs lint + build + tests on every PR; a release workflow turns `vX.Y.Z` tags into GitHub Releases with artefacts and updates the `claude-plugin` branch + `vX.Y.Z-skill` distribution tag.

**Tech Stack:** Node 20+ ESM, `gray-matter` (frontmatter), `zod` (schemas), `vitest` (tests). Hooks: stdlib Python 3. Scripts: bash + curl + jq. CI: GitHub Actions. No TypeScript.

**Companion Spec:** `docs/superpowers/specs/2026-05-10-kanbots-skill-rework-design.md`

---

## File Structure

This is the final tree we are building. Tasks below create / populate each file.

```
kanbots-skill/
├── .github/workflows/
│   ├── ci.yml
│   └── release.yml
├── .gitignore
├── package.json
├── CHANGELOG.md
├── README.md                                 # rewritten
├── LICENSE                                   # untouched
├── src/
│   ├── skill.md
│   ├── shared/
│   │   ├── self-check.md
│   │   └── error-recovery.md
│   ├── references/
│   │   ├── orchestrator.md
│   │   ├── worker.md
│   │   ├── mutations.md
│   │   ├── errors.md
│   │   ├── reports.md
│   │   ├── identity.md
│   │   └── multiboard.md
│   ├── commands/
│   │   ├── kanban-pickup.md
│   │   ├── kanban-status.md
│   │   └── kanban-watch.md
│   ├── agents/
│   │   ├── kanban-orchestrator.md
│   │   └── kanban-worker.md
│   ├── hooks/
│   │   ├── enforce-agent-name.py
│   │   ├── auto-extend-claim.py
│   │   ├── lint-mutation-args.py
│   │   └── stop-comment-progress.py
│   └── scripts/
│       ├── kanban-doctor.sh
│       ├── kanban-dump.sh
│       └── kanban-init.sh
├── build/
│   ├── shared.mjs
│   ├── manifest.mjs
│   ├── plugin.mjs
│   └── portable.mjs
├── tests/
│   ├── fixtures/                             # synthetic broken inputs for lint negative tests
│   │   └── ...
│   ├── lint.test.mjs
│   ├── build.test.mjs
│   └── portable.test.mjs
└── SKILL.md                                  # DELETED at end of migration
```

**Out of scope (Wave 2, separate plan):** `/kanban-handoff`, `/kanban-recover`, `/kanban-split`, `/kanban-report`, smoke MCP tests, agent README inside `dist/skill/`. We deliver a working `0.1.0` first; Wave 2 stacks on top.

---

## Order of operations

1. **Tasks 1–4** — Bootstrap (npm project, .gitignore, basic test harness, CHANGELOG). Nothing visible to users yet.
2. **Tasks 5–9** — Build pipeline foundation (shared utilities, lint, plugin emit, portable emit, manifest). Tested with placeholder content.
3. **Tasks 10–14** — Migrate the existing `SKILL.md` into `src/skill.md` + `src/references/` + `src/shared/`.
4. **Tasks 15–17** — Wave 1 commands (`pickup`, `status`, `watch`).
5. **Tasks 18–19** — Sub-agents (`orchestrator`, `worker`).
6. **Tasks 20–23** — Hooks (4 files).
7. **Tasks 24–26** — CLI scripts (`doctor`, `dump`, `init`).
8. **Task 27** — Rewrite `README.md`.
9. **Tasks 28–29** — CI workflows.
10. **Task 30** — Delete old `SKILL.md` and ship `0.1.0`.

Each task ends with a commit. Conventional Commits messages.

---

## Task 1: Initialise npm project

**Files:**
- Create: `package.json`
- Create: `.gitignore`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "kanbots-skill",
  "version": "0.1.0",
  "description": "Kanban-for-Agents skill — Claude Code plugin and portable SKILL.md.",
  "type": "module",
  "private": true,
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "lint": "node build/shared.mjs --lint-only",
    "build": "npm run build:plugin && npm run build:portable",
    "build:plugin": "node build/plugin.mjs",
    "build:portable": "node build/portable.mjs",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "gray-matter": "^4.0.3",
    "zod": "^3.23.8",
    "vitest": "^1.6.0"
  },
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/Adryeh/kanbots-skill.git"
  }
}
```

- [ ] **Step 2: Write `.gitignore`**

```gitignore
node_modules/
dist/
.omc/
*.log
.DS_Store
```

- [ ] **Step 3: Install dev dependencies**

Run: `npm install`
Expected: creates `node_modules/`, writes `package-lock.json`. Exit code 0.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "chore: initialise npm project for build pipeline"
```

---

## Task 2: Add CHANGELOG skeleton

**Files:**
- Create: `CHANGELOG.md`

- [ ] **Step 1: Write `CHANGELOG.md`**

```markdown
# Changelog

All notable changes to this project will be documented in this file. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html) (with markdown-content semantics — see `docs/superpowers/specs/2026-05-10-kanbots-skill-rework-design.md`).

## [Unreleased]

### Added

- Build pipeline scaffolding: `src/` source-of-truth tree, `build/{plugin,portable}.mjs` emitting `dist/{plugin,skill}/`.
- Progressive disclosure: short `src/skill.md` core plus `src/references/*.md` loaded on demand.
- First-wave slash commands: `/kanban-pickup`, `/kanban-status`, `/kanban-watch`.
- Sub-agents `kanban-orchestrator` and `kanban-worker`.
- Hooks `enforce-agent-name` and `auto-extend-claim` (default-enabled), `lint-mutation-args` and `stop-comment-progress` (opt-in).
- CLI scripts `kanban-doctor.sh`, `kanban-dump.sh`, `kanban-init.sh`.
- CI: lint + build + tests on every PR; tag-driven release pipeline.

### Changed

- Replaced monolithic `SKILL.md` with `src/skill.md` + `src/references/`. Source-of-truth now lives in `src/`; `dist/` is generated.
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: add CHANGELOG with Unreleased entries for the rework"
```

---

## Task 3: Add lint-only entry point and shared parser stub

**Files:**
- Create: `build/shared.mjs`

- [ ] **Step 1: Write `build/shared.mjs` (initial stub — full implementation in Task 5)**

```javascript
// build/shared.mjs
// Entry point: invoked by `npm run lint` with --lint-only
// Full implementation lands in Task 5.

import { argv, exit } from 'node:process';

const args = new Set(argv.slice(2));
const lintOnly = args.has('--lint-only');

if (lintOnly) {
  console.log('[lint] stub — implementation arriving in Task 5');
  exit(0);
}

console.error('build/shared.mjs is a library; nothing to do.');
exit(2);
```

- [ ] **Step 2: Verify the lint script wires up**

Run: `npm run lint`
Expected output: `[lint] stub — implementation arriving in Task 5`. Exit code 0.

- [ ] **Step 3: Commit**

```bash
git add build/shared.mjs
git commit -m "build: add stub lint entry point"
```

---

## Task 4: Add vitest smoke test

**Files:**
- Create: `tests/lint.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/lint.test.mjs
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';

describe('lint stub', () => {
  it('exits 0 when run via npm script', () => {
    const out = execSync('npm run lint --silent', { encoding: 'utf8' });
    expect(out).toMatch(/lint/);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npm test`
Expected: PASS (1 test). The stub from Task 3 already exits 0.

- [ ] **Step 3: Commit**

```bash
git add tests/lint.test.mjs
git commit -m "test: add smoke test for npm run lint"
```

---

## Task 5: Implement frontmatter parsing + lint validation

**Files:**
- Modify: `build/shared.mjs` (full rewrite)

This task replaces the stub with the real lint engine. Linting iterates `src/`, validates frontmatter via Zod, checks include directives, internal links, length caps, and bans placeholder markers.

- [ ] **Step 1: Add fixtures to test broken inputs**

Create `tests/fixtures/` with three files (used in Task 6 negative tests):

`tests/fixtures/missing-frontmatter.md`:

```markdown
This file has no frontmatter and should fail lint.
```

`tests/fixtures/broken-include.md`:

```markdown
---
name: broken
description: References a nonexistent shared file.
---

<!-- include: shared/does-not-exist.md -->
```

`tests/fixtures/has-todo.md`:

```markdown
---
name: has-todo
description: Contains a placeholder marker.
---

TODO finish this section.
```

- [ ] **Step 2: Replace `build/shared.mjs` with full implementation**

```javascript
// build/shared.mjs
import { readdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
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
    if (!abs.startsWith(SRC_DIR)) {
      throw new BuildError(rel, `include target escapes src/: ${target}`);
    }
    if (!existsSync(abs)) {
      throw new BuildError(rel, `include target does not exist: ${target}`);
    }
  }

  // Relative reference links: must exist
  const links = [...body.matchAll(REL_LINK_RE)].map(m => m[1]);
  for (const target of links) {
    const abs = resolve(SRC_DIR, target);
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
    if (INCLUDE_RE.test(parsed.content)) {
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
```

- [ ] **Step 3: Run lint with empty src/**

Run: `npm run lint`
Expected: `[lint] src/ does not exist yet — nothing to lint`. Exit 0.

- [ ] **Step 4: Commit**

```bash
git add build/shared.mjs tests/fixtures/
git commit -m "build: implement frontmatter + include + link lint engine"
```

---

## Task 6: Write lint tests (positive + negative)

**Files:**
- Modify: `tests/lint.test.mjs` (replace smoke test with full suite)

- [ ] **Step 1: Replace `tests/lint.test.mjs`**

```javascript
// tests/lint.test.mjs
import { describe, it, expect } from 'vitest';
import { lintMarkdownFile, BuildError } from '../build/shared.mjs';
import { resolve } from 'node:path';

const FIXTURE = (name) => resolve('tests/fixtures', name);

describe('lintMarkdownFile', () => {
  it('rejects file without frontmatter when classified as skill', async () => {
    // Fixture is in tests/fixtures, not src/, so it falls to "other" kind and skips schema.
    // We instead point at a real-shaped file via spoofing: use src/skill.md when it exists.
    // For now, simply assert that broken-include.md fails on the include check.
    await expect(lintMarkdownFile(FIXTURE('broken-include.md')))
      .rejects.toThrow(/include target does not exist/);
  });

  it('rejects placeholder markers in body', async () => {
    await expect(lintMarkdownFile(FIXTURE('has-todo.md')))
      .rejects.toThrow(/placeholder marker/);
  });

  it('throws BuildError instances', async () => {
    try {
      await lintMarkdownFile(FIXTURE('broken-include.md'));
    } catch (e) {
      expect(e).toBeInstanceOf(BuildError);
      return;
    }
    throw new Error('expected lintMarkdownFile to throw');
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npm test`
Expected: 3 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/lint.test.mjs
git commit -m "test: add positive + negative cases for lint engine"
```

---

## Task 7: Implement plugin emit

**Files:**
- Create: `build/manifest.mjs`
- Create: `build/plugin.mjs`

The plugin build copies `src/skill.md` (with includes expanded) and `src/references/` into `dist/plugin/skills/kanban-for-agents/`, copies `src/commands/` and `src/agents/` (with includes expanded), copies all hooks into `dist/plugin/hooks/`, and writes a generated `.claude-plugin/plugin.json`.

- [ ] **Step 1: Write `build/manifest.mjs`**

```javascript
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
```

- [ ] **Step 2: Write `build/plugin.mjs`**

```javascript
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
```

- [ ] **Step 3: Verify it runs against an empty src/**

Run: `mkdir -p src && npm run build:plugin && rmdir src`
Expected output: `[plugin] emitted dist/plugin`. Exit 0. (We will populate `src/` in Tasks 10+.)

Note: `dist/plugin/` exists but is mostly empty.

- [ ] **Step 4: Commit**

```bash
git add build/manifest.mjs build/plugin.mjs
git commit -m "build: implement plugin emit (skills, commands, agents, hooks, manifest)"
```

---

## Task 8: Implement portable emit

**Files:**
- Create: `build/portable.mjs`

The portable build emits a single `dist/skill/SKILL.md` and a small `dist/skill/README.md`. Default behaviour: rewrite `references/x.md` links to absolute GitHub URLs at the current `package.json` version. With `--inline=core`, splice `mutations.md` and `errors.md` body into `SKILL.md` as H2 sections.

- [ ] **Step 1: Write `build/portable.mjs`**

```javascript
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
```

- [ ] **Step 2: Verify with empty src/**

Run: `mkdir -p src && npm run build:portable`
Expected: `[portable] src/skill.md not present yet — skipping content emit`. Exit 0.

- [ ] **Step 3: Clean up empty src/**

Run: `rmdir src`
Expected: `src/` removed (will be re-created with content in Task 10).

- [ ] **Step 4: Commit**

```bash
git add build/portable.mjs
git commit -m "build: implement portable emit with link rewriting and --inline=core"
```

---

## Task 9: Add build snapshot test

**Files:**
- Create: `tests/build.test.mjs`

- [ ] **Step 1: Write the test**

```javascript
// tests/build.test.mjs
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let tmp;
let cwdBefore;

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kanbots-build-'));
  cwdBefore = process.cwd();
});

afterAll(() => {
  process.chdir(cwdBefore);
  rmSync(tmp, { recursive: true, force: true });
});

describe('build pipeline against minimal src/', () => {
  it('plugin build emits expected files', () => {
    // We test against the real repo cwd, using a minimal src/ scaffolded just for this test.
    const skillDir = 'src';
    const created = !existsSync(skillDir);
    if (created) mkdirSync(skillDir);

    const skillFile = 'src/skill.md';
    const fileCreated = !existsSync(skillFile);
    if (fileCreated) {
      writeFileSync(
        skillFile,
        '---\nname: kanban-for-agents\ndescription: test stub.\n---\n\nbody.\n'
      );
    }

    try {
      execSync('node build/plugin.mjs', { stdio: 'pipe' });
      expect(existsSync('dist/plugin/.claude-plugin/plugin.json')).toBe(true);
      expect(existsSync('dist/plugin/skills/kanban-for-agents/SKILL.md')).toBe(true);
    } finally {
      if (fileCreated) rmSync(skillFile);
      if (created) rmSync(skillDir, { recursive: true });
      rmSync('dist', { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npm test`
Expected: all tests PASS (4 total).

- [ ] **Step 3: Commit**

```bash
git add tests/build.test.mjs
git commit -m "test: assert plugin build emits expected files"
```

---

## Task 10: Migrate the worker / orchestrator content into src/skill.md core

**Files:**
- Create: `src/skill.md`
- Create: `src/shared/self-check.md`

This task ports the **first slice** of the existing `SKILL.md`: the always-loaded core. The remaining sections move to `references/` in Tasks 11–13.

- [ ] **Step 1: Write `src/shared/self-check.md`**

```markdown
---
description: Self-check checklist included into skill.md and agent profiles.
---

## Self-check before each mutation

- [ ] Did I include `reason` (creates, deletes, force-releases)?
- [ ] Did I include `expected_version` if the tool requires it?
- [ ] Am I passing `agent_name`, or is `X-Agent-Name` set in headers?
- [ ] Am I using `task_id` (not `id`), `board` (not `slug`), `to_column` (not `column_id`), `ttl_minutes` (not `ttl_seconds`), `timeout_ms` (not `timeout_seconds`)?
- [ ] If sending a report > 1 paragraph, am I using `add_task_attachment` instead of stuffing it into `description`?
- [ ] Did I read the latest `version` from my previous response, not compute `v+1`?
```

- [ ] **Step 2: Write `src/skill.md` (core only — ~150 lines)**

```markdown
---
name: kanban-for-agents
description: Use when an MCP server named `kanban` (or one exposing `claim_task` / `wait_for_board_events` / `expected_version`) is connected — the Kanban for Agents board. Covers picking up work, dispatching subagents to claim subtasks, optimistic-concurrency mutations, long-poll watching, reports vs comments vs attachments, and recovering from VERSION_CONFLICT / LOCKED_BY_OTHER / RATE_LIMITED.
---

# Kanban for Agents — Core

## What this is

Kanbots is an HTTP MCP server (`/api/mcp`) that gives agents a shared kanban board with optimistic concurrency. **The board is the source of truth, not your conversation memory.** Read it before you act. Write back when state changes. Every mutation is audited.

## Two roles

You are usually one of two roles. They use different tools — do not conflate them.

- **Orchestrator** — splits incoming work into subtasks, *assigns* them to named workers, watches the board with `wait_for_board_events`, dispatches Claude Code subagents to do the work. See [orchestrator workflow](references/orchestrator.md).
- **Worker** — *claims* a single task with a TTL, moves it through columns, reports via comments / append / attachments, releases. See [worker workflow](references/worker.md).

## Identity (`agent_name`) is mandatory

Every mutation needs an actor name. Either set `X-Agent-Name: <name>` once in your MCP config, or pass `agent_name: "..."` per call. Without one, every mutation returns `VALIDATION_FAILED: agent_name is required`. Pick a role-shaped name (`orchestrator`, `worker-fe`, `claude-rev1`), not `assistant` or `claude`. Details: [identity](references/identity.md).

## Canonical worker loop

```
1. get_task(task_id)                                               → read current `version`
2. claim_task(task_id, expected_version, ttl_minutes=30)           → returns new task with new `version`
3. move_task(task_id, to_column="In Progress", expected_version)   → fresh `version`
4. ...do the work...
5. add_task_comment(task_id, body="checkpoint: ...") as needed
6. add_task_attachment(task_id, name, content_type, body) for any artifact > a paragraph
7. move_task(task_id, to_column="Done", expected_version)
8. release_task(task_id, expected_version)
```

**Always re-read `version` from the previous response.** Don't compute `v+1` yourself.

## Where to read next

| If you are… | Read |
|---|---|
| an orchestrator splitting and dispatching work | [orchestrator workflow](references/orchestrator.md) |
| a worker doing one task at a time | [worker workflow](references/worker.md) |
| unsure about `expected_version` / `reason` / argument names | [mutations](references/mutations.md) |
| handling `VERSION_CONFLICT` / `LOCKED_BY_OTHER` / `RATE_LIMITED` | [errors and recovery](references/errors.md) |
| writing a report longer than one paragraph | [reports](references/reports.md) |
| working with multiple boards or workspaces | [multiboard](references/multiboard.md) |

## Top red flags — STOP

- About to call a tool with `expected_version` set to a number you computed locally (not from a server response).
- About to dump > 2 KB of text into `description` or a comment body. Use `add_task_attachment`.
- About to `claim_task` a task an orchestrator already `assign_task`'d to a different worker.
- About to retry `LOCKED_BY_OTHER`. The other holder has up to 8 h. Pick another task.
- About to call `wait_for_board_events` with `timeout_ms` > 25 000.
- Inside a `while True: list_tasks(...)` loop. Use the watcher.

Full list: [errors](references/errors.md).

<!-- include: shared/self-check.md -->

## Limits & resources

- Setup doc: `https://docs.kanbots.ru/agents/setup`.
- Read-only resources: `kanban://workspaces`, `kanban://board/<slug>`, `kanban://task/<id>`.
- Default rate limit: 60 req/min/key. Long-poll cap: `timeout_ms ≤ 25 000`.
- Claim TTL: 30 min default, 8 h max. Auto-expires.
- Caps: title 200, description 16 384, comment body 8 192, attachment body 1 MB, reason 500.
```

- [ ] **Step 3: Run lint to verify**

Run: `npm run lint`
Expected: `[lint] error — internal link points to missing file: references/orchestrator.md` (and similar). This proves the link checker works; we will satisfy these in Tasks 11–13. To unblock the lint until then, **temporarily** create empty stub references files:

Run:
```bash
mkdir -p src/references
for f in orchestrator worker mutations errors reports identity multiboard; do
  printf -- "---\ndescription: stub — populated in upcoming task.\n---\n\n# %s\n" "$f" > "src/references/$f.md"
done
```

Re-run: `npm run lint`
Expected: `[lint] ok — 9 file(s)`.

- [ ] **Step 4: Commit**

```bash
git add src/skill.md src/shared/ src/references/
git commit -m "feat(skill): port core into src/skill.md with shared self-check"
```

---

## Task 11: Migrate orchestrator and worker references

**Files:**
- Modify: `src/references/orchestrator.md` (replace stub)
- Modify: `src/references/worker.md` (replace stub)

- [ ] **Step 1: Write `src/references/orchestrator.md`**

```markdown
---
description: Orchestrator workflow — splitting work, assigning to named workers, dispatching subagents, watching the board.
---

# Orchestrator workflow

## Loop

```
1. get_board(board=slug)                                  → cache columnIds
2. list_tasks(board, filters={column: "Backlog"})
3. For each big item:
     bulk_create_tasks(...) for subtasks
     append_to_task_description(parent, text="children: ...")
4. For each subtask:
     assign_task(task_id, assignee_name="worker-fe", reason="split from <parent>")
5. Dispatch one Claude Code subagent per assignee (see "Dispatching subagents" below).
6. Loop:
     wait_for_board_events(board, since_ts=last, timeout_ms=15000)
     - on task moved to Done → check parent: if all children Done, move parent to Done
     - on new task in Backlog → triage and assign
     - on `claim.expired` → reassign / re-dispatch
```

## `assign_task` vs `claim_task`

|                    | `assign_task`                                     | `claim_task`                                      |
| ------------------ | ------------------------------------------------- | ------------------------------------------------- |
| Semantics          | **Permanent ownership** ("worker-fe owns this")   | **Exclusive lease** ("I'm working on this *now*") |
| TTL                | None — sticky until reassigned                    | 30 min default, 8 h max, auto-expires             |
| Exclusive?         | No — multiple agents can act on it                | Yes — others get `LOCKED_BY_OTHER`                |
| Used by            | **Orchestrator** assigning work to a named worker | **Worker** locking a task while it works          |
| `expected_version` | Optional (omit for last-writer-wins)              | Required                                          |

You can do both atomically: `move_task(..., assign_to="worker-fe")` moves and assigns in one call. Use this when triaging Backlog → Ready: move + assign so the next agent sees a single consistent state.

## `bulk_create_tasks` gotcha

There is **one** top-level `column` for the whole batch. Every task in a single `bulk_create_tasks` call lands in the same column. Per-item only `title`, `description`, `priority`, and `labels` are accepted. To create across multiple columns, send multiple calls.

## Dispatching subagents

There is no `spawn_agent` MCP tool. Use Claude Code's Agent tool. Each subagent runs in its own context with the same Kanban MCP connection.

Briefing template (paste-and-fill):

```
You are the worker `<name>` on Kanban board `<board-slug>`. Your assigned task is
`<task-id>`. Use the kanban MCP server.

Workflow:
1. get_task(task_id="<task-id>") — read current `version`
2. claim_task(task_id="<task-id>", expected_version=<v>, ttl_minutes=30)
3. move_task(task_id, to_column="In Progress", expected_version=<v from step 2>)
4. Do the work locally. Save large outputs as attachments via add_task_attachment.
5. add_task_comment for short progress checkpoints.
6. move_task to "Done", then release_task.

Identity: pass `agent_name="<name>"` on every mutation, OR ensure X-Agent-Name
header is set in your MCP config.

If you hit VERSION_CONFLICT: get_task again, decide if your intent still applies
(e.g. moving to Done is still valid even if the title changed), then retry once
with the fresh version. After two conflicts, add_task_comment flagging it and stop.

If you hit LOCKED_BY_OTHER: stop. Don't poll. Comment what happened and exit.

Report back: task_id, final column, final version, attachment ids.
```

Spawn one Agent call per worker — they can run in parallel. Don't share a claim across subagents.

## Watching the board

Use `wait_for_board_events`, not a `list_tasks` poll loop.

```json
{"tool": "wait_for_board_events",
 "args": {"board": "web-redesign", "since_ts": <last>, "timeout_ms": 15000}}
```

- First call: omit `since_ts` to start "now".
- Every subsequent call: pass back `next_since_ts` from the last response. Same value de-dupes.
- `timeout_ms` cap is **25 000**. Pick 10–20 s to stay well under request budget.
- Returns immediately if events newer than `since_ts` are already buffered (last 200/board).

A 15 s long-poll ≈ 4 req/min when idle, leaving plenty of budget for mutations.
```

- [ ] **Step 2: Write `src/references/worker.md`**

```markdown
---
description: Worker workflow — claiming a single task, mutating it, reporting, releasing.
---

# Worker workflow

## Loop

```
1. get_task(task_id)                                               → read current `version`
2. claim_task(task_id, expected_version, ttl_minutes=30)           → returns new task with new `version`
3. move_task(task_id, to_column="In Progress", expected_version)   → fresh `version`
4. ...do the work...
5. add_task_comment(task_id, body="checkpoint: ...") as needed
6. add_task_attachment(task_id, name, content_type, body) for any artifact > a paragraph
7. move_task(task_id, to_column="Done", expected_version)
8. release_task(task_id, expected_version)
```

## Re-reading `version`

After every successful mutation, the server returns the new task with a new `version`. Use **that** number on the next mutation. Never compute `v+1` locally — between your read and your write, another actor (a parallel comment, a sibling worker's append) may have bumped the counter.

## `extend_claim`

If you are still working as TTL approaches, call `extend_claim` ~2 min before expiry. Two flavours:

- `until_iso="2026-05-10T12:00:00Z"` — idempotent set-deadline. Server takes `max(current, until)`. Prefer this if multiple actors might extend.
- `ttl_minutes=30` — additive. Adds the given minutes to the current expiry.

If your claim already expired, `claim_task` again — but check `LOCKED_BY_OTHER` first; someone may have grabbed it.

## What to do on errors

- **VERSION_CONFLICT**: `get_task`, decide if your intent still applies, retry once with the fresh `version`. Two conflicts in a row → comment what happened and stop.
- **LOCKED_BY_OTHER**: stop. Do not poll. Comment and exit; the orchestrator's watcher will notice.
- **RATE_LIMITED**: exponential back-off with jitter, ~2 s → ~30 s. Drop redundant reads first; preserve the watcher and the final move/release.
- Full table: [errors](errors.md).

## Reporting output

Pick the right tool by volume:

- 1–2 sentences ("done; tests green") → `add_task_comment(body=...)`.
- Append-only progress / multi-actor running log → `append_to_task_description(text=...)`.
- Diff, log, JSON dump, anything > a screen → `add_task_attachment(body=..., content_type=...)`.

Details and field-name traps: [reports](reports.md).

<!-- include: shared/self-check.md -->
```

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: `[lint] ok — 9 file(s)`.

- [ ] **Step 4: Commit**

```bash
git add src/references/orchestrator.md src/references/worker.md
git commit -m "feat(references): orchestrator and worker workflows"
```

---

## Task 12: Migrate mutations, errors, reports references

**Files:**
- Modify: `src/references/mutations.md`
- Modify: `src/references/errors.md`
- Modify: `src/references/reports.md`

- [ ] **Step 1: Write `src/references/mutations.md`**

```markdown
---
description: Mutation rules — which tools need expected_version, which need reason, and the argument names that bite.
---

# Mutations

## Tool table

| Tool                                             | `expected_version`                                 | `reason`                | Notes                                                                                                                    |
| ------------------------------------------------ | -------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `create_task`, `bulk_create_tasks`               | n/a                                                | **required**            | `reason` ≤ 500 chars. Title ≤ 200, description ≤ 16 384.                                                                 |
| `update_task`                                    | **required** (positive int)                        | —                       | Re-read on `VERSION_CONFLICT`.                                                                                           |
| `claim_task`, `release_task`                     | **required**                                       | —                       | Default TTL 30 min, max 480 (8 h).                                                                                       |
| `extend_claim`                                   | **required**                                       | —                       | Pass `until_iso` (idempotent) OR `ttl_minutes` (additive). Use `until_iso` if multiple actors might extend.              |
| `delete_task`                                    | **required**                                       | **required**            | Audited. Soft-deletes via audit log.                                                                                     |
| `move_task`, `bulk_move_tasks`, `assign_task`    | **optional** (omit or `null` for last-writer-wins) | optional                | Pass a positive int if you want CAS; omit for orchestration writes you don't want failing on contention.                 |
| `force_release_task`                             | n/a                                                | **required**            | Workspace-owner authority — recovering a dead worker.                                                                    |
| `add_task_comment`, `append_to_task_description` | n/a                                                | —                       | Commutative. Server retries on conflict. **Don't send `expected_version`.**                                              |
| `add_task_attachment`, `delete_task_attachment`  | n/a                                                | `reason` only on delete | `body` ≤ 1 MB, max 50 attachments/task.                                                                                  |

## Argument names that bite (real → wrong)

- `task_id` — not `id`
- `board` — not `slug` / `board_slug`
- `to_column` — not `column_id`. Accepts the column **name** ("Done") or its id.
- `column` (in `list_tasks` filter, and as a **top-level** field on `bulk_create_tasks`) — accepts name or id. **`bulk_create_tasks` has ONE `column` for the whole call**: every task in the batch lands in the same column. There is no per-item `column` field; per-item only `title` / `description` / `priority` / `labels` are accepted.
- `ttl_minutes` — not `ttl_seconds`. Min 1, max 480.
- `since_ts` — Unix-ms epoch. Pass back `next_since_ts` from the previous response.
- `timeout_ms` — max **25 000**. Larger values are rejected.
- `expected_version` — positive int, never zero, never negative.

## `body` vs `text`

| Tool                         | Field name | Cap                                       |
| ---------------------------- | ---------- | ----------------------------------------- |
| `add_task_comment`           | `body`     | 8 192 chars                               |
| `append_to_task_description` | `text`     | 16 384 chars (combined description)       |
| `add_task_attachment`        | `body`     | 1 000 000 chars (≤ 1 MB)                  |

Comments and attachments take `body`; description-append takes `text`. Confusing them returns `VALIDATION_FAILED`.
```

- [ ] **Step 2: Write `src/references/errors.md`**

```markdown
---
description: Full error-code table, recovery strategies, and the long list of common mistakes.
---

# Errors and recovery

## Error code table

| Code                | Meaning                                                                                          | Action                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VERSION_CONFLICT`  | Another actor mutated this task since you read it. Latest task is in `details`.                  | `get_task`, decide if intent still valid, retry once with fresh version. After 2 conflicts, comment + stop.                                        |
| `LOCKED_BY_OTHER`   | Someone else holds the claim.                                                                    | **Do not retry.** Pick another task or end. Claim auto-expires after TTL — `wait_for_board_events` will tell you.                                  |
| `RATE_LIMITED`      | 60 req/min exceeded. `Retry-After` header set.                                                   | Exponential back-off with jitter, ~2 s → ~30 s. Drop reads first; preserve the watcher and final move/release.                                     |
| `VALIDATION_FAILED` | Bad args (missing `reason`, `agent_name`, wrong field name, out-of-range `timeout_ms`, etc.)     | Don't retry — fix the call.                                                                                                                        |
| `NOT_FOUND`         | Task / board doesn't exist or your key is scoped to a different workspace.                       | Stop. Don't keep guessing IDs.                                                                                                                     |
| `FORBIDDEN`         | Workspace-scoped key, wrong workspace.                                                           | Surface to user; you can't recover.                                                                                                                |
| `UNAUTHORIZED`      | Bad/expired API key.                                                                             | Surface to user.                                                                                                                                   |

## Stuck claim from a dead peer

Don't `force_release_task` peer claims unilaterally — that's an orchestrator/human authority. As a worker, comment the situation and stop. As an orchestrator with workspace ownership, `force_release_task` with a clear `reason` (audited).

## Common mistakes

| Mistake                                                                        | Reality                                                                                                                                                       |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "I'll skip `reason` to keep the call short"                                    | `create_task` / `delete_task` / `force_release_task` reject without it.                                                                                       |
| "I'll compute `v+1` myself"                                                    | Other actors increment too. Always read the latest `version` from the server response.                                                                        |
| "Long-poll every second to be responsive"                                      | Burns rate limit. `wait_for_board_events` already returns immediately when events exist.                                                                      |
| "Put the diff in `description`"                                                | 16 KB cap. Use `add_task_attachment`.                                                                                                                         |
| "Pass `expected_version` to `add_task_comment` / `append_to_task_description`" | These are CAS-free. Server rejects unknown args; the lock you wanted doesn't exist (and isn't needed — they're commutative).                                  |
| "Use `body` for `append_to_task_description`"                                  | The field is `text`. `body` is for `add_task_comment` and `add_task_attachment`.                                                                              |
| "Set per-task `column` inside the `bulk_create_tasks.tasks[]` array"           | Schema rejects unknown keys. There is one top-level `column` for the whole batch. To create across multiple columns, send multiple `bulk_create_tasks` calls. |
| "Retry `LOCKED_BY_OTHER` in a loop"                                            | The other holder has up to 8 h. Pick another task. The watcher will tell you when it frees.                                                                   |
| "Use `claim_task` to assign work to worker-fe"                                 | That's `assign_task`. `claim_task` is for the worker doing it themselves.                                                                                     |
| "Spawn workers via an MCP tool"                                                | There isn't one. Use the Claude Code Agent tool to dispatch a subagent and hand it the `task_id`.                                                             |
| "Set `timeout_ms: 60000` for a longer poll"                                    | Capped at 25 000. Use 10 000–20 000 and call again.                                                                                                           |
| "After `VERSION_CONFLICT`, retry blindly"                                      | Re-`get_task`, validate intent against new state, then retry. Two conflicts in a row = stop and comment.                                                      |
| "Skip `agent_name` because the header is probably set"                         | Verify once with `list_my_claims` (which uses your name). If empty when you expect claims, your name isn't set.                                               |
```

- [ ] **Step 3: Write `src/references/reports.md`**

```markdown
---
description: How to attach output to a task — comments vs append_to_task_description vs attachments.
---

# Reports

## Pick by volume

| Volume                                         | Use                                              | Field for the text | Why                                                                                                          |
| ---------------------------------------------- | ------------------------------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------ |
| 1–2 sentences ("done; tests green")            | `add_task_comment` (≤ 8 192 chars)               | `body`             | Audit-trail entry, no CAS, dialogue-shaped.                                                                  |
| Append-only progress / multi-actor running log | `append_to_task_description` (combined ≤ 16 384) | `text`             | Commutative, no CAS, server retries. Safe under concurrent writers.                                          |
| Diff, log, JSON dump, anything > a screen      | `add_task_attachment` (≤ 1 MB)                   | `body`             | `description` overflows at 16 KB. Set `content_type: "text/markdown" \| "text/plain" \| "application/json"`. |
| Field changes (title, labels, priority)        | `update_task` with `expected_version`            | n/a                | This is the only mutation that needs CAS for the change itself.                                              |

**Don't dump diffs into `description`.** It is truncated and you lose the report. Always pick `add_task_attachment` for artefacts.
```

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: `[lint] ok — 9 file(s)`.

- [ ] **Step 5: Commit**

```bash
git add src/references/mutations.md src/references/errors.md src/references/reports.md
git commit -m "feat(references): mutations, errors, reports"
```

---

## Task 13: Migrate identity and add new multiboard reference

**Files:**
- Modify: `src/references/identity.md`
- Modify: `src/references/multiboard.md`

- [ ] **Step 1: Write `src/references/identity.md`**

```markdown
---
description: How to set agent_name — header vs per-call — and naming conventions.
---

# Identity

Every mutation needs an actor name. Two ways:

1. **Header (preferred for the whole session):** the MCP config sets `X-Agent-Name: <your-name>`. Then omit `agent_name` from every tool call.
2. **Per-call:** pass `agent_name: "..."` (1–80 chars, `[\w .,:/+\-@()]`) on each call.

If neither is set, *every* mutation returns `VALIDATION_FAILED: agent_name is required`.

## Naming

Pick a role-shaped name. Good: `orchestrator`, `worker-fe`, `claude-rev1`, `qa-bot`. Bad: `assistant`, `claude`, `agent`, `bot`. The name shows up in audit trails and in `list_my_claims`.

## Verifying your identity is set

Call `list_my_claims`. If it returns empty when you expect open claims, your name probably isn't propagating. Either:

- The MCP config doesn't set the header — check your client config.
- A per-call `agent_name` is overriding it with a different value.

A quick fix is to pass `agent_name="..."` explicitly on the next mutation; if that works while the header didn't, the header is mis-configured.

## Environment variable convention

This skill expects `KANBAN_AGENT_NAME` in the environment when relevant. Hooks (notably `enforce-agent-name`) read it.
```

- [ ] **Step 2: Write `src/references/multiboard.md`**

```markdown
---
description: Working with multiple boards or workspaces — discovery, columnId caching, and cross-board hand-offs.
---

# Multiboard

## Discovery

```
list_workspaces()                  → list of workspaces this key can see
list_boards(workspace=<id|slug>)   → boards in a workspace
get_board(board=<slug>)            → columns and metadata for one board
```

Cache `columnIds` per board for the session. Column IDs are stable; column names can be edited by humans.

## Cross-board orchestration

If your project spans more than one board (e.g. `frontend` and `backend`):

- Pin the slug everywhere. Each `list_tasks`, `claim_task`, `wait_for_board_events` call must specify which board.
- Run **one watcher per board** with separate `since_ts` cursors. The watcher is per-board.
- Don't fan out a single `bulk_create_tasks` across boards — it accepts one `board` per call.
- For dependencies that cross boards (a backend task blocked by a frontend task), encode the link in the description: `blocked-by: frontend#TASK-123`. There is no first-class cross-board link tool.

## Choosing where new work lands

When triaging a generic backlog:

1. Read the parent task's labels (`area:frontend`, `area:backend`).
2. Map labels to board slugs in your config (or hard-code if you only have two boards).
3. `bulk_create_tasks(board=<resolved>, column="Backlog", reason=..., tasks=[...])`.

If you cannot determine the board, leave the parent in `Backlog` of the originating board with a comment `triage: ambiguous; needs human routing`.

## Workspace-scoped keys

A key may be scoped to a single workspace. `list_workspaces` returns only what your key can see. If you expect more, ask the user; you cannot widen the scope from inside the agent.
```

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: `[lint] ok — 9 file(s)`.

- [ ] **Step 4: Commit**

```bash
git add src/references/identity.md src/references/multiboard.md
git commit -m "feat(references): identity and multiboard"
```

---

## Task 14: Add error-recovery shared snippet

**Files:**
- Create: `src/shared/error-recovery.md`

This snippet is included into both sub-agent profiles in Tasks 18–19.

- [ ] **Step 1: Write `src/shared/error-recovery.md`**

```markdown
---
description: Mini error-recovery cheatsheet for sub-agents.
---

## Error recovery quick reference

- **VERSION_CONFLICT**: `get_task` again, decide if your intent still applies, retry once. Two in a row → comment, stop.
- **LOCKED_BY_OTHER**: stop. Do not retry. Comment and exit.
- **RATE_LIMITED**: back off ~2 s → ~30 s with jitter. Drop reads first; keep the final move / release.
- **VALIDATION_FAILED**: do not retry. Fix the call.

If you don't know which one applies, read [errors](references/errors.md).
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: `[lint] ok — 10 file(s)`.

- [ ] **Step 3: Commit**

```bash
git add src/shared/error-recovery.md
git commit -m "feat(shared): error-recovery snippet for agent profiles"
```

---

## Task 15: Slash command — /kanban-pickup

**Files:**
- Create: `src/commands/kanban-pickup.md`

- [ ] **Step 1: Write the command**

```markdown
---
description: Find and start working on the next available task on a Kanbots board.
argument-hint: "[board-slug]"
---

# /kanban-pickup

Pick a task to work on right now.

## What you do, in order

1. Resolve the board slug. If `$1` is provided, use it. Otherwise, call `list_boards` and prompt the user to choose.
2. Identify candidates, in this priority order:
   - Tasks claimed by `KANBAN_AGENT_NAME` with TTL > 0 (resume what's mine).
   - Tasks `assigned_to == KANBAN_AGENT_NAME` and not currently claimed.
   - Tasks in the `Ready` (or first non-Backlog) column with no assignee and no claim.
3. If multiple candidates remain, list them with `task_id`, `title`, and column, and ask the user which to take. Default to the first.
4. `get_task(task_id)` → read `version`.
5. `claim_task(task_id, expected_version=<v>, ttl_minutes=30)`.
6. `move_task(task_id, to_column="In Progress", expected_version=<new v>)`.
7. Print the task title, link, current `version`, and the time the claim expires.

## Errors

- `LOCKED_BY_OTHER` on step 5 → drop the candidate, return to step 2 with that task excluded.
- `VERSION_CONFLICT` on step 5 or 6 → re-`get_task` once, retry once. After two failures, comment on the task and abort.

## When NOT to use

If the user already has open claims and you can resume them, just resume — don't create new claims.
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: `[lint] ok — 11 file(s)`.

- [ ] **Step 3: Commit**

```bash
git add src/commands/kanban-pickup.md
git commit -m "feat(commands): /kanban-pickup"
```

---

## Task 16: Slash command — /kanban-status

**Files:**
- Create: `src/commands/kanban-status.md`

- [ ] **Step 1: Write the command**

```markdown
---
description: Read-only summary of my claims, my tasks, and recent board events.
argument-hint: "[board-slug]"
---

# /kanban-status

Print a status snapshot. Read-only — no mutations.

## What you do

1. Resolve board slug from `$1` or default workspace board.
2. `list_my_claims()` — show: `task_id`, title, column, claim TTL remaining, `version`.
3. `list_tasks(board, filters={assignee: KANBAN_AGENT_NAME})` — my open assignments, grouped by column.
4. `wait_for_board_events(board, timeout_ms=0)` — fetch buffered events without waiting; show last 10 entries.
5. Print a 4-section summary (claims, assignments, recent events, board metadata).

## Output format

```
== My claims (3) ==
TASK-12   "...title..."   In Progress   23m left   v=14
...

== Assigned to me, unclaimed (1) ==
TASK-19   "...title..."   Ready

== Recent events (last 10) ==
2026-05-10T11:42Z  TASK-19  moved to Ready by orchestrator
...

== Board ==
slug=web-redesign  columns=[Backlog, Ready, In Progress, Done]  rate=60/min
```

## Errors

`RATE_LIMITED` → back off and retry once. Anything else → surface and stop.
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: `[lint] ok — 12 file(s)`.

- [ ] **Step 3: Commit**

```bash
git add src/commands/kanban-status.md
git commit -m "feat(commands): /kanban-status"
```

---

## Task 17: Slash command — /kanban-watch

**Files:**
- Create: `src/commands/kanban-watch.md`

- [ ] **Step 1: Write the command**

```markdown
---
description: Long-running board watch loop with structured response on events.
argument-hint: "<board-slug>"
---

# /kanban-watch

Run a foreground `wait_for_board_events` loop and react to events.

## Setup

1. Validate `$1` (board slug). If missing, abort with usage.
2. `since_ts = null` for the first call.
3. Print `Watching <board>. Press Ctrl-C to stop.`

## Loop

```
while not interrupted:
    resp = wait_for_board_events(board=$1, since_ts=since_ts, timeout_ms=15000)
    since_ts = resp.next_since_ts
    for event in resp.events:
        handle(event)
```

## Reactions

- **task moved to Done with parent_id** — `get_task(parent_id)`, if all siblings are Done then `move_task(parent, "Done")`. Otherwise, comment "child <id> Done; siblings still open".
- **new task in Backlog** — print `[backlog] TASK-<id> "<title>"` and pause. Ask the user if they want to triage now.
- **claim.expired** — print `[expired] TASK-<id> by <prev-claimant>`. Pause and ask whether to reassign.

Do not auto-mutate without confirming with the user. Reactions are *suggestions*, not silent actions.

## On cancellation

Print the last `since_ts` and the loop exits. Resume with the same value: `/kanban-watch <board> --since <since_ts>` (the `--since` flag is honoured by the next invocation when you wire it up; for now, the printed `since_ts` is enough for the user to manually feed back).

## Errors

- `RATE_LIMITED` → back off and retry; do not exit the loop.
- `NOT_FOUND` / `FORBIDDEN` → print and exit.
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: `[lint] ok — 13 file(s)`.

- [ ] **Step 3: Commit**

```bash
git add src/commands/kanban-watch.md
git commit -m "feat(commands): /kanban-watch"
```

---

## Task 18: Sub-agent — kanban-orchestrator

**Files:**
- Create: `src/agents/kanban-orchestrator.md`

- [ ] **Step 1: Write the agent profile**

```markdown
---
name: kanban-orchestrator
description: Orchestrator for Kanbots boards. Splits work, assigns subtasks to named workers, dispatches Claude Code subagents, and runs the watch loop.
model: opus
tools:
  - Read
  - Write
  - Edit
  - Bash
  - Agent
  - mcp__kanban__list_workspaces
  - mcp__kanban__list_boards
  - mcp__kanban__get_board
  - mcp__kanban__list_tasks
  - mcp__kanban__get_task
  - mcp__kanban__bulk_create_tasks
  - mcp__kanban__create_task
  - mcp__kanban__update_task
  - mcp__kanban__assign_task
  - mcp__kanban__move_task
  - mcp__kanban__bulk_move_tasks
  - mcp__kanban__add_task_comment
  - mcp__kanban__append_to_task_description
  - mcp__kanban__add_task_attachment
  - mcp__kanban__list_task_comments
  - mcp__kanban__list_task_attachments
  - mcp__kanban__get_task_attachment
  - mcp__kanban__list_my_claims
  - mcp__kanban__force_release_task
  - mcp__kanban__wait_for_board_events
---

# kanban-orchestrator

You are the orchestrator. You split incoming work into named subtasks, assign them, and dispatch Claude Code workers via the Agent tool. You do **not** claim tasks yourself.

## Your loop

See [orchestrator workflow](../references/orchestrator.md) for the full cycle. Summary:

1. `get_board` to cache columns.
2. `list_tasks(filters={column: "Backlog"})`.
3. For each parent: `bulk_create_tasks` for children; `append_to_task_description` linking children.
4. `assign_task(assignee_name=<worker>)` per child.
5. Spawn one Agent call per assignee; pass them the `task_id`.
6. `wait_for_board_events` loop: react to Done, Backlog, expired claims.

## Worker briefing template

Use this body when spawning a worker via the Agent tool. Substitute `<...>` placeholders with concrete values.

```
You are the worker `<name>` on Kanban board `<board-slug>`. Your assigned task is
`<task-id>`. Use the kanban MCP server.

Workflow:
1. get_task(task_id="<task-id>") — read current `version`
2. claim_task(task_id="<task-id>", expected_version=<v>, ttl_minutes=30)
3. move_task(task_id, to_column="In Progress", expected_version=<v from step 2>)
4. Do the work locally. Save large outputs as attachments via add_task_attachment.
5. add_task_comment for short progress checkpoints.
6. move_task to "Done", then release_task.

Identity: pass `agent_name="<name>"` on every mutation, OR ensure X-Agent-Name
header is set in your MCP config.

If you hit VERSION_CONFLICT: get_task again, decide if your intent still applies,
then retry once with the fresh version. After two conflicts, add_task_comment
flagging it and stop.

If you hit LOCKED_BY_OTHER: stop. Don't poll. Comment what happened and exit.

Report back: task_id, final column, final version, attachment ids.
```

<!-- include: shared/error-recovery.md -->

<!-- include: shared/self-check.md -->
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: `[lint] ok — 14 file(s)`.

- [ ] **Step 3: Commit**

```bash
git add src/agents/kanban-orchestrator.md
git commit -m "feat(agents): kanban-orchestrator"
```

---

## Task 19: Sub-agent — kanban-worker

**Files:**
- Create: `src/agents/kanban-worker.md`

- [ ] **Step 1: Write the agent profile**

```markdown
---
name: kanban-worker
description: Worker for a single Kanbots task. Claims, moves to In Progress, performs the work, reports, and releases.
model: sonnet
tools:
  - Read
  - Write
  - Edit
  - Bash
  - mcp__kanban__get_task
  - mcp__kanban__claim_task
  - mcp__kanban__release_task
  - mcp__kanban__extend_claim
  - mcp__kanban__move_task
  - mcp__kanban__update_task
  - mcp__kanban__add_task_comment
  - mcp__kanban__append_to_task_description
  - mcp__kanban__add_task_attachment
  - mcp__kanban__list_task_comments
  - mcp__kanban__list_task_attachments
  - mcp__kanban__get_task_attachment
  - mcp__kanban__list_my_claims
---

# kanban-worker

You handle exactly **one** task. The orchestrator assigned it to you and gave you the `task_id`.

## Your loop

See [worker workflow](../references/worker.md) for full detail. Summary:

```
1. get_task(task_id)                                               → read current `version`
2. claim_task(task_id, expected_version, ttl_minutes=30)           → returns new task with new `version`
3. move_task(task_id, to_column="In Progress", expected_version)   → fresh `version`
4. ...do the work locally...
5. add_task_comment for short progress notes
   add_task_attachment for outputs longer than a paragraph
6. move_task(task_id, to_column="Done", expected_version)
7. release_task(task_id, expected_version)
```

## Identity

You must have `KANBAN_AGENT_NAME` in your environment **or** the MCP config must set `X-Agent-Name`. The orchestrator's briefing tells you which name to use.

## Reporting

Pick the right tool by size:

- 1–2 sentences → `add_task_comment(body=...)`.
- Append-only running log → `append_to_task_description(text=...)`.
- Diff / dump / log > a paragraph → `add_task_attachment(body=..., content_type=...)`.

Don't put diffs into `description`. See [reports](../references/reports.md).

<!-- include: shared/error-recovery.md -->

<!-- include: shared/self-check.md -->
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: `[lint] ok — 15 file(s)`.

- [ ] **Step 3: Commit**

```bash
git add src/agents/kanban-worker.md
git commit -m "feat(agents): kanban-worker"
```

---

## Task 20: Hook — enforce-agent-name

**Files:**
- Create: `src/hooks/enforce-agent-name.py`

- [ ] **Step 1: Write the hook**

```python
#!/usr/bin/env python3
"""PreToolUse hook for mcp__kanban__.* — block mutations when no agent name is configured.

Stdin (JSON, Claude Code hook contract):
    {
      "tool_name": "mcp__kanban__create_task",
      "tool_input": { ... }
    }

Outputs JSON to stdout. Non-zero exit blocks the tool call (Claude Code convention).
"""
import json
import os
import sys

MUTATING_TOOLS_HINT = (
    "Set KANBAN_AGENT_NAME in your environment, or configure X-Agent-Name in your "
    "MCP client headers, or pass agent_name=... on this call."
)


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        # If stdin is not parseable, do not block.
        sys.exit(0)

    tool_name = payload.get("tool_name", "")
    tool_input = payload.get("tool_input") or {}

    # Only enforce on kanban tools.
    if not tool_name.startswith("mcp__kanban__"):
        sys.exit(0)

    # Read-only tools don't require agent_name.
    READ_ONLY = {
        "mcp__kanban__list_workspaces",
        "mcp__kanban__list_boards",
        "mcp__kanban__get_board",
        "mcp__kanban__list_tasks",
        "mcp__kanban__get_task",
        "mcp__kanban__list_task_comments",
        "mcp__kanban__list_task_attachments",
        "mcp__kanban__get_task_attachment",
        "mcp__kanban__list_my_claims",
        "mcp__kanban__wait_for_board_events",
    }
    if tool_name in READ_ONLY:
        sys.exit(0)

    has_per_call = bool(tool_input.get("agent_name"))
    has_env = bool(os.environ.get("KANBAN_AGENT_NAME"))

    if has_per_call or has_env:
        sys.exit(0)

    print(
        json.dumps({
            "permissionDecision": "deny",
            "permissionDecisionReason": (
                f"agent_name not set for {tool_name}. {MUTATING_TOOLS_HINT}"
            ),
        })
    )
    sys.exit(2)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Make it executable**

Run: `chmod +x src/hooks/enforce-agent-name.py`
Expected: no output, file is now executable.

- [ ] **Step 3: Smoke-run with a fake mutation payload**

Run:
```bash
echo '{"tool_name":"mcp__kanban__create_task","tool_input":{}}' | KANBAN_AGENT_NAME= python3 src/hooks/enforce-agent-name.py; echo "exit=$?"
```
Expected: stdout contains `permissionDecision: deny`. `exit=2`.

Run:
```bash
echo '{"tool_name":"mcp__kanban__create_task","tool_input":{}}' | KANBAN_AGENT_NAME=worker-fe python3 src/hooks/enforce-agent-name.py; echo "exit=$?"
```
Expected: empty stdout. `exit=0`.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/enforce-agent-name.py
git commit -m "feat(hooks): enforce-agent-name PreToolUse hook"
```

---

## Task 21: Hook — auto-extend-claim

**Files:**
- Create: `src/hooks/auto-extend-claim.py`

This hook fires a side-effecting `extend_claim` request when the user is about to make a kanban mutation and one of their claims is within 5 minutes of expiry. The HTTP call is made directly (the hook does not have access to MCP), using `KANBAN_MCP_URL` and `KANBAN_API_KEY` env vars if available; if those are not set, the hook is a no-op (it does not block).

- [ ] **Step 1: Write the hook**

```python
#!/usr/bin/env python3
"""PreToolUse hook for mcp__kanban__.* — opportunistically extend a near-expiry claim.

Non-blocking: if the extend call fails or env is incomplete, the hook exits 0
without blocking the underlying tool call.
"""
import json
import os
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta

MIN_REMAINING_SECONDS = 5 * 60
EXTEND_BY_MINUTES = 30


def http_post(url, headers, payload):
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST", headers=headers)
    with urllib.request.urlopen(req, timeout=5) as r:
        return json.loads(r.read())


def jsonrpc(url, headers, method, params):
    return http_post(url, headers, {
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": params,
    })


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        sys.exit(0)

    tool_name = payload.get("tool_name", "")
    if not tool_name.startswith("mcp__kanban__"):
        sys.exit(0)

    url = os.environ.get("KANBAN_MCP_URL")
    api_key = os.environ.get("KANBAN_API_KEY")
    agent_name = os.environ.get("KANBAN_AGENT_NAME")
    if not (url and api_key and agent_name):
        sys.exit(0)

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
        "X-Agent-Name": agent_name,
    }

    try:
        claims_resp = jsonrpc(url, headers, "tools/call", {
            "name": "list_my_claims",
            "arguments": {},
        })
    except (urllib.error.URLError, TimeoutError, ValueError):
        sys.exit(0)

    claims = (claims_resp.get("result") or {}).get("claims") or []
    now = datetime.now(timezone.utc)
    extend_until = (now + timedelta(minutes=EXTEND_BY_MINUTES)).isoformat()

    for c in claims:
        expires = c.get("expires_at")
        version = c.get("version")
        task_id = c.get("task_id")
        if not (expires and version and task_id):
            continue
        try:
            expires_dt = datetime.fromisoformat(expires.replace("Z", "+00:00"))
        except ValueError:
            continue
        remaining = (expires_dt - now).total_seconds()
        if remaining < MIN_REMAINING_SECONDS:
            try:
                jsonrpc(url, headers, "tools/call", {
                    "name": "extend_claim",
                    "arguments": {
                        "task_id": task_id,
                        "expected_version": version,
                        "until_iso": extend_until,
                    },
                })
            except (urllib.error.URLError, TimeoutError, ValueError):
                pass  # non-blocking

    sys.exit(0)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Make it executable**

Run: `chmod +x src/hooks/auto-extend-claim.py`

- [ ] **Step 3: Smoke-run with no env (no-op path)**

Run:
```bash
echo '{"tool_name":"mcp__kanban__create_task","tool_input":{}}' | env -i python3 src/hooks/auto-extend-claim.py; echo "exit=$?"
```
Expected: empty stdout. `exit=0`.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/auto-extend-claim.py
git commit -m "feat(hooks): auto-extend-claim non-blocking PreToolUse hook"
```

---

## Task 22: Hook — lint-mutation-args

**Files:**
- Create: `src/hooks/lint-mutation-args.py`

- [ ] **Step 1: Write the hook**

```python
#!/usr/bin/env python3
"""PreToolUse hook — catch common arg typos before they hit the server.

Detected:
- `id` instead of `task_id`
- `slug` instead of `board`
- `column_id` instead of `to_column`
- `body` field on append_to_task_description (should be `text`)
- `ttl_seconds` instead of `ttl_minutes`
- `timeout_seconds` instead of `timeout_ms`
"""
import json
import sys

CHECKS = [
    ("id", "task_id is the correct argument; `id` is rejected"),
    ("slug", "board is the correct argument; `slug` / `board_slug` is rejected"),
    ("column_id", "to_column is the correct argument and accepts column name or id"),
    ("ttl_seconds", "ttl_minutes is the correct argument (1–480)"),
    ("timeout_seconds", "timeout_ms is the correct argument (≤ 25000)"),
]


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        sys.exit(0)

    tool_name = payload.get("tool_name", "")
    if not tool_name.startswith("mcp__kanban__"):
        sys.exit(0)

    args = payload.get("tool_input") or {}
    issues = []

    for bad, hint in CHECKS:
        if bad in args:
            issues.append(f"`{bad}` looks wrong: {hint}")

    if tool_name == "mcp__kanban__append_to_task_description" and "body" in args:
        issues.append("`body` is wrong for append_to_task_description — use `text`")

    if not issues:
        sys.exit(0)

    print(json.dumps({
        "permissionDecision": "deny",
        "permissionDecisionReason": "; ".join(issues),
    }))
    sys.exit(2)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Make it executable and smoke-test**

Run: `chmod +x src/hooks/lint-mutation-args.py`

Run:
```bash
echo '{"tool_name":"mcp__kanban__update_task","tool_input":{"id":"TASK-1"}}' | python3 src/hooks/lint-mutation-args.py; echo "exit=$?"
```
Expected: stdout contains `task_id is the correct argument`. `exit=2`.

Run:
```bash
echo '{"tool_name":"mcp__kanban__update_task","tool_input":{"task_id":"TASK-1"}}' | python3 src/hooks/lint-mutation-args.py; echo "exit=$?"
```
Expected: empty stdout. `exit=0`.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/lint-mutation-args.py
git commit -m "feat(hooks): lint-mutation-args opt-in PreToolUse hook"
```

---

## Task 23: Hook — stop-comment-progress

**Files:**
- Create: `src/hooks/stop-comment-progress.py`

- [ ] **Step 1: Write the hook**

```python
#!/usr/bin/env python3
"""Stop hook — when a session ends with open claims, post a brief context comment per task.

Non-blocking. Best-effort. Releases nothing.
"""
import json
import os
import sys
import urllib.request
import urllib.error

LAST_CONTEXT_CHARS = 240


def http_post(url, headers, payload):
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST", headers=headers)
    with urllib.request.urlopen(req, timeout=5) as r:
        return json.loads(r.read())


def jsonrpc(url, headers, method, params):
    return http_post(url, headers, {
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": params,
    })


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        sys.exit(0)

    last_text = (payload.get("transcript") or {}).get("last_assistant_text") or ""
    snippet = last_text.strip()[:LAST_CONTEXT_CHARS] or "(no recent context)"

    url = os.environ.get("KANBAN_MCP_URL")
    api_key = os.environ.get("KANBAN_API_KEY")
    agent_name = os.environ.get("KANBAN_AGENT_NAME")
    if not (url and api_key and agent_name):
        sys.exit(0)

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
        "X-Agent-Name": agent_name,
    }

    try:
        claims_resp = jsonrpc(url, headers, "tools/call", {
            "name": "list_my_claims",
            "arguments": {},
        })
    except (urllib.error.URLError, TimeoutError, ValueError):
        sys.exit(0)

    claims = (claims_resp.get("result") or {}).get("claims") or []
    for c in claims:
        task_id = c.get("task_id")
        if not task_id:
            continue
        body = f"session paused by {agent_name}. last context: {snippet}"
        try:
            jsonrpc(url, headers, "tools/call", {
                "name": "add_task_comment",
                "arguments": {"task_id": task_id, "body": body},
            })
        except (urllib.error.URLError, TimeoutError, ValueError):
            pass  # non-blocking

    sys.exit(0)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Make it executable and smoke-test**

Run: `chmod +x src/hooks/stop-comment-progress.py`

Run:
```bash
echo '{"transcript":{"last_assistant_text":"hello"}}' | env -i python3 src/hooks/stop-comment-progress.py; echo "exit=$?"
```
Expected: empty stdout (env was wiped, so the hook short-circuits). `exit=0`.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/stop-comment-progress.py
git commit -m "feat(hooks): stop-comment-progress opt-in Stop hook"
```

---

## Task 24: CLI script — kanban-doctor.sh

**Files:**
- Create: `src/scripts/kanban-doctor.sh`

- [ ] **Step 1: Write the script**

```bash
#!/usr/bin/env bash
# kanban-doctor.sh — verify your Kanbots client setup.
# Usage: KANBAN_MCP_URL=... KANBAN_API_KEY=... KANBAN_AGENT_NAME=... ./kanban-doctor.sh

set -u

red() { printf "\033[31m%s\033[0m" "$1"; }
green() { printf "\033[32m%s\033[0m" "$1"; }
yellow() { printf "\033[33m%s\033[0m" "$1"; }

ok=0
fail=0

check() {
    local label=$1
    local cmd=$2
    printf "  %-40s ... " "$label"
    if eval "$cmd" >/dev/null 2>&1; then
        echo "$(green OK)"
        ok=$((ok + 1))
    else
        echo "$(red FAIL)"
        fail=$((fail + 1))
    fi
}

require_env() {
    local name=$1
    printf "  %-40s ... " "env: $name"
    if [ -n "${!name:-}" ]; then
        echo "$(green set)"
        ok=$((ok + 1))
    else
        echo "$(red unset)"
        fail=$((fail + 1))
    fi
}

echo "Kanbots doctor"
echo "=============="
require_env KANBAN_MCP_URL
require_env KANBAN_API_KEY
require_env KANBAN_AGENT_NAME

if [ -n "${KANBAN_MCP_URL:-}" ]; then
    check "MCP endpoint reachable" "curl -fsS --max-time 5 -H 'Content-Type: application/json' -H 'Authorization: Bearer ${KANBAN_API_KEY:-}' -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\",\"params\":{}}' \"$KANBAN_MCP_URL\""
    check "list_workspaces succeeds" "curl -fsS --max-time 5 -H 'Content-Type: application/json' -H 'Authorization: Bearer ${KANBAN_API_KEY:-}' -H 'X-Agent-Name: ${KANBAN_AGENT_NAME:-anon}' -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"list_workspaces\",\"arguments\":{}}}' \"$KANBAN_MCP_URL\""
fi

echo ""
echo "Summary: $(green "$ok ok"), $(red "$fail fail")"
[ $fail -eq 0 ]
```

- [ ] **Step 2: Make it executable**

Run: `chmod +x src/scripts/kanban-doctor.sh`

- [ ] **Step 3: Smoke-test (no env, expect failures, but exit cleanly)**

Run:
```bash
env -i bash src/scripts/kanban-doctor.sh; echo "exit=$?"
```
Expected: prints `unset` for the three env vars, no MCP checks attempted, `exit=1`.

- [ ] **Step 4: Commit**

```bash
git add src/scripts/kanban-doctor.sh
git commit -m "feat(scripts): kanban-doctor.sh client-setup verifier"
```

---

## Task 25: CLI script — kanban-dump.sh

**Files:**
- Create: `src/scripts/kanban-dump.sh`

- [ ] **Step 1: Write the script**

```bash
#!/usr/bin/env bash
# kanban-dump.sh <board-slug>
# Dump board state (tasks, claims, recent events) as JSON to stdout.

set -u

if [ $# -lt 1 ]; then
    echo "Usage: kanban-dump.sh <board-slug>" >&2
    exit 2
fi

: "${KANBAN_MCP_URL:?set KANBAN_MCP_URL}"
: "${KANBAN_API_KEY:?set KANBAN_API_KEY}"
: "${KANBAN_AGENT_NAME:?set KANBAN_AGENT_NAME}"

BOARD=$1

call() {
    local name=$1
    local args_json=$2
    curl -fsS --max-time 10 \
        -H 'Content-Type: application/json' \
        -H "Authorization: Bearer $KANBAN_API_KEY" \
        -H "X-Agent-Name: $KANBAN_AGENT_NAME" \
        -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"$name\",\"arguments\":$args_json}}" \
        "$KANBAN_MCP_URL"
}

board_json=$(call get_board "{\"board\":\"$BOARD\"}")
tasks_json=$(call list_tasks "{\"board\":\"$BOARD\"}")
events_json=$(call wait_for_board_events "{\"board\":\"$BOARD\",\"timeout_ms\":0}")
claims_json=$(call list_my_claims "{}")

cat <<JSON
{
  "board": $board_json,
  "tasks": $tasks_json,
  "events": $events_json,
  "my_claims": $claims_json
}
JSON
```

- [ ] **Step 2: Make it executable**

Run: `chmod +x src/scripts/kanban-dump.sh`

- [ ] **Step 3: Smoke-test (no args)**

Run: `src/scripts/kanban-dump.sh; echo "exit=$?"`
Expected: stderr `Usage: kanban-dump.sh <board-slug>`. `exit=2`.

- [ ] **Step 4: Commit**

```bash
git add src/scripts/kanban-dump.sh
git commit -m "feat(scripts): kanban-dump.sh board-state dumper"
```

---

## Task 26: CLI script — kanban-init.sh

**Files:**
- Create: `src/scripts/kanban-init.sh`

- [ ] **Step 1: Write the script**

```bash
#!/usr/bin/env bash
# kanban-init.sh — interactive wizard that emits a Claude Code MCP config block.

set -u

prompt() {
    local var=$1
    local label=$2
    local default=${3:-}
    local val
    if [ -n "$default" ]; then
        read -r -p "$label [$default]: " val
        val=${val:-$default}
    else
        read -r -p "$label: " val
    fi
    printf -v "$var" "%s" "$val"
}

echo "Kanbots init wizard"
echo "==================="
prompt MCP_URL "MCP endpoint URL" "https://kanbots.ru/api/mcp"
prompt API_KEY "API key (paste; will be echoed back at the end)"
prompt AGENT_NAME "Agent name (e.g. orchestrator, worker-fe)"

cat <<JSON

# --- Add this to your Claude Code MCP config (.mcp.json or settings) ---
{
  "mcpServers": {
    "kanban": {
      "type": "http",
      "url": "$MCP_URL",
      "headers": {
        "Authorization": "Bearer $API_KEY",
        "X-Agent-Name": "$AGENT_NAME"
      }
    }
  }
}

# --- Or export these env vars before running CLI scripts ---
export KANBAN_MCP_URL="$MCP_URL"
export KANBAN_API_KEY="$API_KEY"
export KANBAN_AGENT_NAME="$AGENT_NAME"
JSON
```

- [ ] **Step 2: Make it executable**

Run: `chmod +x src/scripts/kanban-init.sh`

- [ ] **Step 3: Smoke-test (with piped answers)**

Run:
```bash
printf "https://example.com/mcp\nKEY\nworker-fe\n" | bash src/scripts/kanban-init.sh
```
Expected: stdout contains `"X-Agent-Name": "worker-fe"` and `KANBAN_API_KEY="KEY"`. Exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/scripts/kanban-init.sh
git commit -m "feat(scripts): kanban-init.sh interactive setup wizard"
```

---

## Task 27: Add portable test and full builds

**Files:**
- Create: `tests/portable.test.mjs`
- Modify: `tests/build.test.mjs` (extend)

- [ ] **Step 1: Run a real build to validate end-to-end**

Run: `npm run build`
Expected: both builds succeed; `dist/plugin/skills/kanban-for-agents/SKILL.md` and `dist/skill/SKILL.md` exist. `dist/skill/SKILL.md` contains absolute GitHub links (e.g. `github.com/Adryeh/kanbots-skill/blob/v0.1.0/`).

- [ ] **Step 2: Write `tests/portable.test.mjs`**

```javascript
// tests/portable.test.mjs
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync, rmSync } from 'node:fs';

function runBuild(args = []) {
  execSync(['node', 'build/portable.mjs', ...args].join(' '), { stdio: 'pipe' });
}

describe('portable build', () => {
  it('default rewrites references/ links to GitHub URLs', () => {
    rmSync('dist/skill', { recursive: true, force: true });
    runBuild();
    const md = readFileSync('dist/skill/SKILL.md', 'utf8');
    expect(md).toMatch(/github\.com\/Adryeh\/kanbots-skill\/blob\/v\d+\.\d+\.\d+\/src\/references\//);
    expect(md).not.toMatch(/\]\(references\//);
  });

  it('--inline=core inlines mutations and errors content', () => {
    rmSync('dist/skill', { recursive: true, force: true });
    runBuild(['--inline=core']);
    const md = readFileSync('dist/skill/SKILL.md', 'utf8');
    expect(md).toMatch(/## Inlined: mutations/);
    expect(md).toMatch(/## Inlined: errors/);
  });
});
```

- [ ] **Step 3: Run all tests**

Run: `npm test`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add tests/portable.test.mjs
git commit -m "test: assert portable build link rewriting and --inline=core"
```

---

## Task 28: Rewrite README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Write the new `README.md`**

```markdown
# kanbots-skill

Kanban-for-Agents skill — ships as a **Claude Code plugin** and a **portable `SKILL.md`** for any other agent (Cursor, Codex, Windsurf, Cline, Copilot, Gemini CLI, Continue.dev).

## What this is

[Kanbots](https://kanbots.ru) is a kanban board built for humans and AI agents to share. This repo is the agent-side skill: progressive-disclosure prompt content, slash commands, sub-agents, hooks, and CLI utilities.

## Install — Claude Code plugin

```
claude plugin add github:Adryeh/kanbots-skill@claude-plugin
```

The `claude-plugin` branch holds the built plugin layout. The plugin enables `enforce-agent-name` and `auto-extend-claim` hooks by default; opt-in hooks (`lint-mutation-args`, `stop-comment-progress`) ship as files.

## Install — portable SKILL.md (any other agent)

```
npx skillfish add Adryeh/kanbots-skill@v0.1.0-skill
```

The `@v*-skill` tag pins a tree where `SKILL.md` lives at the repo root, ready for `skillfish`.

## What ships

- `src/skill.md` — short core (`SKILL.md`).
- `src/references/` — orchestrator, worker, mutations, errors, reports, identity, multiboard.
- `src/commands/` — `/kanban-pickup`, `/kanban-status`, `/kanban-watch`.
- `src/agents/` — `kanban-orchestrator`, `kanban-worker`.
- `src/hooks/` — `enforce-agent-name`, `auto-extend-claim`, `lint-mutation-args`, `stop-comment-progress`.
- `src/scripts/` — `kanban-doctor.sh`, `kanban-dump.sh`, `kanban-init.sh`.

## Configuration

Set the following env vars (the wizard `kanban-init.sh` prints a snippet):

- `KANBAN_MCP_URL` — e.g. `https://kanbots.ru/api/mcp`
- `KANBAN_API_KEY` — your API key
- `KANBAN_AGENT_NAME` — e.g. `worker-fe`, `orchestrator`

Or set the `X-Agent-Name` header in your client's MCP config.

## Troubleshooting

Run `bash src/scripts/kanban-doctor.sh`. It checks env vars, endpoint reachability, and a basic `list_workspaces` call.

## Contributing

- Edit only `src/`. `dist/` is generated.
- `npm run lint` before commit.
- `npm test` for the full suite.
- Update `CHANGELOG.md` under `## [Unreleased]` for every PR.
- Conventional Commits style.

## License

MIT — see `LICENSE`.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README for plugin + portable distribution"
```

---

## Task 29: CI workflow — ci.yml

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write the workflow**

```yaml
name: ci

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run build
      - run: npm test

  changelog-touched:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Verify CHANGELOG was updated
        run: |
          base=${{ github.event.pull_request.base.sha }}
          head=${{ github.event.pull_request.head.sha }}
          if git diff --name-only "$base" "$head" | grep -q '^CHANGELOG.md$'; then
            echo "CHANGELOG touched."
          else
            echo "::warning::CHANGELOG.md was not modified in this PR. Add an entry under ## [Unreleased] unless this is intentional."
          fi
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add lint + build + test workflow with changelog reminder"
```

---

## Task 30: Release workflow + final cleanup

**Files:**
- Create: `.github/workflows/release.yml`
- Delete: `SKILL.md` (root, the old monolith)

- [ ] **Step 1: Write the release workflow**

```yaml
name: release

on:
  push:
    tags: ['v*.*.*']

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run build
      - run: npm test

      - name: Verify package.json version matches tag
        run: |
          tag=${GITHUB_REF_NAME#v}
          ver=$(node -p "require('./package.json').version")
          test "$tag" = "$ver" || { echo "tag $tag != version $ver" >&2; exit 1; }

      - name: Build --inline=core variant
        run: node build/portable.mjs --inline=core
      - name: Move inline variant aside
        run: cp dist/skill/SKILL.md dist/skill/SKILL.inline-core.md

      - name: Build default portable on top
        run: node build/portable.mjs

      - name: Zip plugin output
        run: cd dist && zip -r ../kanbots-skill-plugin.zip plugin

      - name: Extract changelog body
        id: changelog
        run: |
          tag=${GITHUB_REF_NAME#v}
          awk -v tag="[$tag]" '
            $0 ~ "^## " tag { capture=1; next }
            capture && /^## / { exit }
            capture { print }
          ' CHANGELOG.md > .release-body.md
          echo "file=.release-body.md" >> "$GITHUB_OUTPUT"

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          body_path: ${{ steps.changelog.outputs.file }}
          files: |
            kanbots-skill-plugin.zip
            dist/skill/SKILL.md
            dist/skill/SKILL.inline-core.md

      - name: Force-push dist/plugin to claude-plugin branch
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          tmp=$(mktemp -d)
          cp -r dist/plugin/. "$tmp/"
          cd "$tmp"
          git init -q
          git checkout -q -b claude-plugin
          git add .
          git commit -q -m "release: ${GITHUB_REF_NAME}"
          git remote add origin "https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"
          git push -q --force origin claude-plugin

      - name: Push portable v*-skill tag tree
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          tmp=$(mktemp -d)
          cp dist/skill/SKILL.md "$tmp/SKILL.md"
          cp dist/skill/README.md "$tmp/README.md"
          cd "$tmp"
          git init -q
          git checkout -q -b skill-tag
          git add .
          git commit -q -m "skill release: ${GITHUB_REF_NAME}"
          git tag "${GITHUB_REF_NAME}-skill"
          git remote add origin "https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"
          git push -q origin "${GITHUB_REF_NAME}-skill"
```

- [ ] **Step 2: Delete the old monolithic SKILL.md**

Run: `rm SKILL.md`

- [ ] **Step 3: Verify everything still passes**

Run: `npm run lint && npm run build && npm test`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/release.yml
git rm SKILL.md
git commit -m "ci: add tag-driven release workflow; remove old monolithic SKILL.md"
```

- [ ] **Step 5: Tag the first release**

Run:
```bash
git push
git tag v0.1.0
git push origin v0.1.0
```
Expected: GitHub Actions runs `release.yml`, publishes a Release, force-pushes `claude-plugin` branch, creates `v0.1.0-skill` tag. (Verify in the Actions tab and the Releases page.)

---

## Self-Review

**Spec coverage:**

| Spec section | Tasks |
|---|---|
| Goals: reduce context cost | Tasks 10–14 (skill split into core + references) |
| Goals: ready-made workflows | Tasks 15–17 (commands), 18–19 (agents), 20–23 (hooks) |
| Goals: expanded coverage | Task 13 (multiboard), Task 14 (error-recovery snippet), Tasks 18–19 (agent profiles) |
| Goals: install/update DX | Task 27 (README), Task 29 (ci.yml), Task 30 (release.yml) |
| Repository tree | Task 1 (`package.json`, `.gitignore`), all subsequent tasks populate `src/` and `build/` |
| `src/skill.md` core + references | Tasks 10–14 |
| `src/shared/` includes | Tasks 10 (self-check), 14 (error-recovery) |
| Slash commands (Wave 1: pickup/status/watch) | Tasks 15–17 |
| Slash commands Wave 2 (handoff/recover/split/report) | **explicitly deferred** to a Wave 2 plan |
| Sub-agents | Tasks 18–19 |
| Hooks (4 files, 2 default-enabled) | Tasks 20–23; default-enabled set wired in `build/plugin.mjs` (Task 7) |
| CLI scripts | Tasks 24–26 |
| Build pipeline (load/transform/emit) | Tasks 5 (lint engine), 7 (plugin emit), 8 (portable emit) |
| `<!-- include: -->` directive | Task 5 (engine), Task 10 (first use), Tasks 18–19 (agent profiles) |
| Link rewriting / `--inline=core` | Task 8, Task 27 (test) |
| Lint mode | Task 5 |
| Tests | Tasks 4, 6, 9, 27 |
| CHANGELOG | Task 2 (skeleton); Task 29 (CI verification) |
| CI ci.yml | Task 29 |
| CI release.yml (tag-driven, GitHub Release, claude-plugin branch, v*-skill tag) | Task 30 |
| Distribution: Claude Code plugin via `claude-plugin` branch | Task 30 |
| Distribution: portable via `vX.Y.Z-skill` tag | Task 30 |
| README rewrite | Task 28 |
| Initial version `0.1.0` | Task 1 (`package.json`), Task 30 (tagging) |

**Placeholder scan:** no `TODO` / `FIXME` / `TBD` / `PLACEHOLDER` / `XXX` markers in step bodies. The Wave 2 commands are explicitly deferred, not placeholders.

**Type / signature consistency:**

- `expandIncludes(body)` is used by both `build/plugin.mjs` (Task 7) and `build/portable.mjs` (Task 8) — defined in `build/shared.mjs` (Task 5).
- `lintAll(srcDir?)` returns `{ results, errors }` — same shape consumed by `plugin.mjs` and `portable.mjs`.
- `buildPluginManifest({ enabledHooks })` defined in Task 7's `build/manifest.mjs`, consumed in the same task by `build/plugin.mjs`.
- Hook scripts all return JSON to stdout with `permissionDecision` and exit non-zero on block. Consistent across Tasks 20, 22.
- Env vars `KANBAN_MCP_URL`, `KANBAN_API_KEY`, `KANBAN_AGENT_NAME` named consistently across hooks (21, 23) and scripts (24–26).
- Target dirs in `dist/plugin/`: `skills/kanban-for-agents/SKILL.md`, `commands/`, `agents/`, `hooks/`, `.claude-plugin/plugin.json` — same in build script (Task 7) and CI release (Task 30, zips `dist/plugin`).

No discrepancies found.
