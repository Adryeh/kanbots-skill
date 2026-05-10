# Kanbots Skill — Rework Design

- **Status:** Draft
- **Date:** 2026-05-10
- **Author:** Adry (with Claude)
- **Repo:** `Adryeh/kanbots-skill`

## Goals

Improve the Kanbots agent skill on four fronts at once:

1. **Reduce per-invocation context cost.** Today `SKILL.md` is ~21 KB and loads in full on every trigger. Move to progressive disclosure: a short core file plus on-demand `references/`.
2. **Ship ready-made workflows.** Users repeatedly hand-roll the same multi-step Kanbots flows (pickup, status, watch, handoff). Provide slash commands, sub-agents, and hooks.
3. **Expand functional coverage.** Document scenarios that today are absent or under-covered (multiboard, recovery, metrics, automated claim extension).
4. **Improve install/update DX.** Ship two artefacts from a single source: a Claude Code plugin (commands, hooks, MCP-aware sub-agents) and a portable skill (markdown only) for Cursor/Codex/etc. Versioned, with CHANGELOG and a tag-driven release pipeline.

The board (`https://kanbots.ru`) and the MCP server are out of scope — this rework only changes the skill artefact.

## Non-goals

- Do **not** change the Kanbots MCP API. The skill follows whatever the server exposes.
- Do **not** introduce TypeScript, a templating engine, or runtime dependencies for the build.
- Do **not** publish to npm registry as a runtime package — distribution is via GitHub tags consumed by Claude Code plugin marketplace and `skillfish`.
- Do **not** preserve backwards compatibility with the current monolithic `SKILL.md` layout. The first reworked release ships at `0.1.0`.

## Constraints / Inputs

- **Single source of truth:** this repository. The plugin and the portable skill are both built from `src/`.
- **MCP API is actively evolving:** commands and hooks must remain resilient to new tools/fields. Concretely: read `version` from each server response (never compute `v+1`); when forwarding tool args, pass through unknown fields rather than re-validating against a baked-in schema; treat references docs as paraphrased guidance rather than authoritative API.
- **Targets:** Claude Code is primary (gets full plugin), all other agents (Cursor, Codex, Windsurf, Cline, Copilot, Gemini CLI, Continue.dev) get the portable `SKILL.md`.
- **Trigger frontmatter must keep working** — current `description` regex (`claim_task`, `wait_for_board_events`, `expected_version`) is preserved verbatim.

## Architecture Overview

Two-stage system: a hand-edited `src/` tree, and a build pipeline that emits two distinct distributions.

```
src/  ──►  build/{plugin,portable}.mjs  ──►  dist/{plugin,skill}/
```

`dist/` is git-ignored on `main` and committed only on release tags / distribution branches.

### Repository tree

```
kanbots-skill/
├── .github/
│   └── workflows/
│       ├── ci.yml                # lint + build + tests on PR
│       └── release.yml           # tag v*.*.* → build → GitHub Release + dist branches
├── src/                          # SOURCE OF TRUTH (only this is hand-edited)
│   ├── skill.md                  # core (~150 lines / ~6 KB)
│   ├── references/
│   │   ├── orchestrator.md
│   │   ├── worker.md
│   │   ├── mutations.md
│   │   ├── errors.md
│   │   ├── reports.md
│   │   ├── identity.md
│   │   └── multiboard.md
│   ├── commands/                 # Claude Code slash commands (markdown)
│   ├── agents/                   # Claude Code sub-agent profiles
│   │   ├── kanban-orchestrator.md
│   │   └── kanban-worker.md
│   ├── hooks/                    # PreToolUse / Stop scripts (Python or bash)
│   ├── scripts/                  # user-facing CLI utilities (shell)
│   └── shared/                   # snippets included into multiple files
│       ├── self-check.md
│       └── error-recovery.md
├── build/
│   ├── plugin.mjs                # emits dist/plugin/
│   ├── portable.mjs              # emits dist/skill/
│   ├── shared.mjs                # frontmatter parse, include directive, link rewriting
│   └── manifest.mjs              # generates .claude-plugin/plugin.json
├── dist/                         # generated (gitignored on main)
│   ├── plugin/
│   └── skill/
├── tests/
│   ├── lint.test.mjs
│   ├── build.test.mjs
│   └── portable.test.mjs
├── CHANGELOG.md
├── README.md
├── LICENSE
├── package.json
└── .gitignore
```

### Folder responsibilities

| Folder | Hand-edited? | Consumed by | Purpose |
|---|---|---|---|
| `src/skill.md` | yes | agent runtime (always loaded) | minimal entry point; routes to `references/` |
| `src/references/` | yes | agent runtime (loaded on demand) | detailed rules; progressive disclosure |
| `src/commands/` | yes | Claude Code | slash commands |
| `src/agents/` | yes | Claude Code | sub-agent definitions |
| `src/hooks/` | yes | Claude Code runtime | PreToolUse / Stop automations |
| `src/scripts/` | yes | end user (shell) | `kanban-doctor`, `kanban-dump`, `kanban-init` |
| `src/shared/` | yes | build pipeline | snippets included into multiple files |
| `build/` | yes | npm scripts | build pipeline |
| `dist/` | no, generated | distributions (marketplace, skillfish) | release artefacts |
| `tests/` | yes | CI | regression checks |

## SKILL.md core + references

### `src/skill.md` (the core)

Contains only:

1. Frontmatter (preserved from current).
2. One-paragraph “What is Kanbots” framing — board is the source of truth, optimistic concurrency, mutations audited.
3. One sentence on each role (orchestrator vs worker), with explicit links to `references/orchestrator.md` and `references/worker.md`.
4. One paragraph on identity (`agent_name` / `X-Agent-Name`), linking to `references/identity.md`.
5. The canonical 7-step worker loop (no tables).
6. A navigation table — “if you are doing X, read Y”.
7. Top-5 Red Flags (compact). Full list in `references/errors.md`.
8. The self-check checklist, included from `src/shared/self-check.md`.
9. A small “Limits & resources” block (rate limit, claim TTL, description / comment / attachment caps, doc URLs).

### `src/references/`

| File | Content | Approx. size |
|---|---|---|
| `orchestrator.md` | full orchestrator loop, `assign_task` vs `claim_task`, `bulk_create_tasks` gotchas, dispatching subagents, briefing template | ~4 KB |
| `worker.md` | full worker loop, `claim_task` → `move_task` → release, `extend_claim`, conflict handling per step | ~3 KB |
| `mutations.md` | full table of tools (CAS / reason / fields), “argument names that bite”, `body` vs `text` | ~3 KB |
| `errors.md` | full error-code table with recovery; expanded Common Mistakes | ~2 KB |
| `reports.md` | comments vs append vs attachments, `content_type` choices, limits | ~2 KB |
| `identity.md` | `X-Agent-Name` setup, validation, naming conventions | ~1 KB |
| `multiboard.md` | **new** — workspaces / multiple boards, `list_workspaces`, `list_boards`, columnId caching | ~2 KB |

Total ~17 KB across files; the core that always loads is ~6 KB. The rest is read by the agent only when it follows a link.

### `src/shared/self-check.md`

The 5-bullet pre-mutation checklist (current `SKILL.md` lines 186–194). Included via the `<!-- include: -->` directive into `src/skill.md`, `src/agents/kanban-orchestrator.md`, and `src/agents/kanban-worker.md`. No copy-paste.

### Link contract

- Inside `src/`, internal links are relative: `[orchestrator workflow](references/orchestrator.md)`.
- Plugin build keeps relative links (references/ ship next to `SKILL.md`).
- Portable build rewrites links to `https://github.com/Adryeh/kanbots-skill/blob/v{version}/src/references/{file}.md` (pinned tag).
- Portable build supports `--inline=core`: inlines `references/mutations.md` and `references/errors.md` into `SKILL.md` for agents that cannot follow URLs.

## Catalog: commands, agents, hooks, scripts

### Slash commands (`src/commands/`)

7 commands. The build emits all of them; users wire what they want.

| Command | Args | Behaviour | Risk |
|---|---|---|---|
| `/kanban-pickup` | `[board?]` | Pick the next task to work on (claimed-by-me with TTL > 0 → assigned-to-me → unclaimed in Ready). Performs `claim_task` and `move_task` to “In Progress”. | low; primary use case |
| `/kanban-status` | `[board?]` | Read-only summary: my active claims, ETA to expiry, my open tasks, last 10 board events. | none |
| `/kanban-watch` | `[board]` | Long-running `wait_for_board_events` loop responding to: new Backlog, claim.expired, parent ready to move. Foreground; on cancel (Ctrl-C / user signal) prints the last `since_ts` so the loop can be resumed. | medium; consumes request budget |
| `/kanban-handoff` | `<task_id> <to_agent>` | Release my claim, reassign via `assign_task`, leave a context comment. | low |
| `/kanban-recover` | `<task_id>` | Diagnostic: reads task, analyses `version` / claims / locks, prints recovery steps. Read-only. | none |
| `/kanban-split` | `<task_id>` | Interactively decompose a parent task into subtasks via `bulk_create_tasks`, append child links to parent description. | medium |
| `/kanban-report` | `<task_id>` | Pick the right reporting tool (comment / append / attachment) based on size and type, with the correct field name (`body` vs `text`). | low |

Wave 1 (MVP): `/kanban-pickup`, `/kanban-status`, `/kanban-watch`. Wave 2: the rest.

Conventions:
- Commands read `agent_name` from the MCP config / env (`KANBAN_AGENT_NAME`); not asked per-call.
- All commands are non-destructive on first run (`/kanban-pickup` confirms before claiming if multiple candidates exist).
- `/kanban-watch` runs foreground and surfaces every event — never silently background.

### Sub-agents (`src/agents/`)

| Agent | Triggered by | Scope | Model | Tool whitelist |
|---|---|---|---|---|
| `kanban-orchestrator` | main session sees a large backlog item | full board context, dispatches workers via Agent tool, runs watch loop | `opus` | `mcp__kanban__*`, `Read`, `Write`, `Edit`, `Bash`, `Agent` |
| `kanban-worker` | spawned by orchestrator per assigned task | minimal: one `task_id` + `board`, runs the worker loop | `sonnet` | `mcp__kanban__*`, `Read`, `Write`, `Edit`, `Bash` |

Both agents include `src/shared/self-check.md` and `src/shared/error-recovery.md` via the include directive.

### Hooks (`src/hooks/`)

| Hook | Type | Behaviour | Default |
|---|---|---|---|
| `enforce-agent-name.py` | PreToolUse (matcher: `mcp__kanban__.*`) | Block if neither `KANBAN_AGENT_NAME` env nor `X-Agent-Name` header is set; suggest fix. | **enabled** |
| `auto-extend-claim.py` | PreToolUse (matcher: `mcp__kanban__.*`) | If my claim expires within 5 min, fire `extend_claim(until_iso=now+30m)` non-blockingly (does not delay the original mutation). Idempotent (`until_iso` semantics: server takes `max(current_expiry, until)`). | **enabled** |
| `lint-mutation-args.py` | PreToolUse (matcher: `mcp__kanban__.*`) | Detect common typos (`id`, `slug`, `body` for `append_to_task_description`, etc.); block with hint. | opt-in |
| `stop-comment-progress.py` | Stop | On session exit with open claims, post a short context comment per task. Does not release. | opt-in |

All hooks are pure stdlib Python, no third-party deps. Hooks either block (with a hint) or fire follow-up calls non-blockingly; they do **not** mutate the agent payload.

### CLI scripts (`src/scripts/`)

User-facing shell utilities. Not Claude hooks.

| Script | Purpose |
|---|---|
| `kanban-doctor.sh` | Verify MCP reachable, key valid, agent name configured, board accessible. Prints a coloured checklist. |
| `kanban-dump.sh <board>` | Dump current board state to JSON: tasks per column, claims, recent events. For debugging. |
| `kanban-init.sh` | Interactive wizard: agent name, MCP URL, key. Prints the config snippet for the chosen agent. |

## Build pipeline

### Stack

- Node.js 20+ ESM (`"type": "module"`).
- Zero runtime deps in `dependencies`. `devDependencies`: `gray-matter`, `marked`, `zod`, `vitest`.
- npm scripts:
  - `npm run build` — both targets
  - `npm run build:plugin` / `npm run build:portable`
  - `npm run lint` — lint without emitting
  - `npm test`
  - `npm run release` — orchestrates version bump → build → tag → push (see Release section)

### Pipeline phases

```
load + validate  →  transform  →  emit
```

**Load + validate** (`build/shared.mjs`):

- Walk `src/`, parse markdown files with `gray-matter`.
- Validate frontmatter via Zod schemas:
  - `skill.md`: `name`, `description` (≤ 1024 chars), optional fields.
  - `commands/*.md`: `description`, optional `argument-hint`.
  - `agents/*.md`: `name`, `description`, optional `model` ∈ `{haiku, sonnet, opus}`, optional `tools` array.
  - `hooks/*`: must be executable with shebang.
- Validation failures throw `BuildError` with `path:line: message`. Build stops.

**Transform**: one directive only.

```
<!-- include: shared/self-check.md -->
```

The line is replaced with the file’s contents. Recursion forbidden — included files cannot themselves include.

For portable build, additionally:
- Internal links `references/x.md` → `https://github.com/Adryeh/kanbots-skill/blob/v{version}/src/references/x.md`.
- With `--inline=core`, splice `mutations.md` and `errors.md` content into `SKILL.md` as H2 sections.

**Emit**:

`build/plugin.mjs` writes:

```
dist/plugin/
├── .claude-plugin/plugin.json
├── skills/kanban-for-agents/
│   ├── SKILL.md
│   └── references/*.md
├── commands/*.md
├── agents/*.md
└── hooks/*
```

`plugin.json` is generated from `package.json` and `build/manifest.mjs`. `hooks` section enables only the **default-enabled** hooks (`enforce-agent-name`, `auto-extend-claim`); the opt-in hooks (`lint-mutation-args`, `stop-comment-progress`) are still copied into `dist/plugin/hooks/` and documented in `dist/plugin/README.md`, but absent from `plugin.json` so they stay dormant until the user wires them in.

`build/portable.mjs` writes:

```
dist/skill/
├── SKILL.md
└── README.md
```

By default `SKILL.md` is the core + a footer listing the GitHub URLs of references. With `--inline=core`, the critical sections are inlined.

### Lint mode

Same pipeline up to transform, but no emit. Runs on every PR via CI, and locally before commit. Checks:

- Frontmatter schemas pass.
- All internal links resolve to existing files.
- No length-limit violations on hard-capped fields.
- `<!-- include: -->` targets exist; no cycles.
- No `TODO`/`FIXME`/`PLACEHOLDER` markers in `src/`.

### Tests

| File | Coverage |
|---|---|
| `tests/lint.test.mjs` | every `src/` file passes lint; broken fixtures fail loudly |
| `tests/build.test.mjs` | both `npm run build:*` produce expected directory structure (snapshot) |
| `tests/portable.test.mjs` | `SKILL.md` under `--inline=core` contains the inlined sections; without it, references are URLs |
| `tests/smoke.test.mjs` (optional) | real MCP calls against `KANBAN_TEST_URL`; skipped when env is unset |

### Explicitly out of scope

- TypeScript / custom type system.
- A general-purpose template engine (no conditionals, no loops in markdown).
- File watcher.
- Source maps / pretty error renderers.
- skillfish integration code (the skill packs itself; skillfish just sees a normal repo).

## Release process

### Versioning (SemVer with markdown semantics)

| Bump | Trigger | Example |
|---|---|---|
| patch | text edits, typo fixes, clarifications | refined `body` vs `text` wording |
| minor | added a command / agent / hook / references file; new functionality without breaking changes | added `/kanban-watch` |
| major | renamed skill, removed a command, broke `plugin.json` shape | renamed `kanban-for-agents` → `kanbots` |

Initial reworked release: **`0.1.0`**.

`1.0.0` reserved for: (a) Kanbots MCP protocol stable, (b) user feedback incorporated, (c) command and hook formats locked.

### CHANGELOG

Keep a Changelog format. Every PR appends to `## [Unreleased]`. On release, `[Unreleased]` is renamed to `[X.Y.Z] - YYYY-MM-DD` and a new empty `[Unreleased]` is created.

CI checks that `[Unreleased]` was modified (warning by default; failure on release tags).

### CI / CD

`ci.yml` (every PR / push to `main`):
- `npm ci`
- `npm run lint`
- `npm run build`
- `npm test`
- Verify CHANGELOG `[Unreleased]` entry exists (warn unless labelled `no-changelog`).

`release.yml` (tag push `v*.*.*`):
- Run lint + tests + build.
- Verify `package.json` version equals tag without `v`.
- Extract changelog body for this version.
- Create GitHub Release with that body, attach:
  - `dist/plugin/` zipped
  - `dist/skill/SKILL.md` (default)
  - `dist/skill/SKILL.md` built with `--inline=core` (separate file)
- Force-push `dist/plugin/` contents (root-level layout) to a `claude-plugin` branch — Claude Code marketplace consumes this branch.
- Push a parallel tag (e.g. `v0.2.0-skill`) to a tree where `dist/skill/SKILL.md` is committed at the repo root, so `npx skillfish add Adryeh/kanbots-skill@vX.Y.Z` resolves it directly. The corresponding `vX.Y.Z` plain tag stays attached to the source commit on `main`.

Release command for the maintainer:

```
npm version minor
git push origin main --follow-tags
```

### Distribution

**Claude Code plugin**: install via `claude plugin add github:Adryeh/kanbots-skill@claude-plugin` (the `claude-plugin` branch holds the built plugin layout at root).

**Portable skill**: install via `npx skillfish add Adryeh/kanbots-skill[@vX.Y.Z-skill]`. The release pipeline ensures the `*-skill` tagged tree contains a root-level `SKILL.md` for `skillfish` to find. Without the suffix `skillfish` falls back to the plain tag, which contains only `src/` and would fail — README documents the suffixed form as canonical.

If the Claude Code marketplace later requires a different distribution shape (separate repo, different manifest), the release pipeline is the only thing that changes.

### README outline

The reworked `README.md` documents:

1. What the skill does (1–2 paragraphs).
2. Installation — two sections:
   - Claude Code plugin (`claude plugin add ...`).
   - Any other agent (`npx skillfish add ...`).
3. What ships — short list of commands, agents, hooks (one line each).
4. Configuration — `KANBAN_AGENT_NAME`, `KANBAN_MCP_URL`, optional `X-Agent-Name` header.
5. Troubleshooting — `kanban-doctor.sh` first.
6. Contributing — edit only `src/`, run `npm run lint && npm test`, update CHANGELOG.
7. License.

## Key Decisions

1. **Single source of truth, two builds.** `src/` is hand-edited; `dist/{plugin,skill}/` is generated. No manual edits to `dist/`.
2. **Progressive disclosure.** Core `SKILL.md` ~6 KB; details in `references/` loaded on demand. ~70% reduction in always-on context cost.
3. **One markdown directive (`<!-- include: -->`).** No template engine. Snippet sharing only, no logic.
4. **Hooks default-off except two recommended.** Users opt in to the rest. Avoids surprise behaviour.
5. **`dist/` lives off `main`.** Distributed via release branches and tag trees, not committed to `main`. Keeps `git diff` clean.
6. **Plugin marketplace via `claude-plugin` branch in this repo for MVP.** Separate repo only if marketplace requires it.
7. **`0.1.0` is the new starting line.** No backwards compatibility with the current `SKILL.md` layout.
8. **CHANGELOG mandatory per PR.** Enforced softly in CI, hard at release time.
9. **Node 20 + ESM, no TypeScript.** Build is ~400 lines of JS, fully readable in one sitting.
10. **MCP API is volatile, so the skill is conservative.** Tools/fields documented in references are paraphrased; commands rely on conventions, not hard-coded argument lists.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| `skillfish` cannot find `SKILL.md` at the tag root | Release pipeline writes a root-level `SKILL.md` on tagged trees; verified by `tests/portable.test.mjs` and a smoke install in CI. |
| Claude Code plugin marketplace requires a separate repo | Release pipeline already isolates plugin output to a branch; switching to a separate repo is an operations change, not a code change. |
| MCP API drifts and references become stale | References are short, focused files. CI links each reference to a smoke test (where feasible). The `Limits & resources` block in core lists the canonical doc URL. |
| Hooks misbehave on user systems (Python missing, permission errors) | All default hooks are stdlib Python, fail-open with a clear log line, never block work indefinitely. |
| Slash commands become brittle when MCP adds new fields | Commands prefer reading the latest `version` from server responses and avoid hard-coding tool argument lists; new fields surface as additions, not breaks. |

## Out of scope (explicitly)

- A web UI for browsing the skill.
- Automatic ingestion of changelog entries from PR titles (manual writes for now).
- Telemetry of skill usage.
- Localisation (English-only; current skill is English).

## Next step

After approval, hand off to the `writing-plans` skill for an implementation plan covering: scaffold the build pipeline, migrate `SKILL.md` content into core + references, write commands / agents / hooks Wave 1, add CI, ship `0.1.0`.
