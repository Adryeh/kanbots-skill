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
