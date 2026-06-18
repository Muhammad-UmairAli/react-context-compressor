---
name: hardening
status: backlog
created: 2026-06-18T15:49:59Z
progress: 0%
prd: .claude/prds/hardening.md
github: (will be set on sync)
---

# Epic: hardening

## Overview

Release-quality hardening of `react-context-compressor`, shipped as `0.2.0`. Four
tasks: packaging guards + sourcemap trim (CI), Node/React version matrices (CI),
robustness hardening (core/sanitize), and edge-case test backfill. No API change,
no new runtime deps. The 0.2.0 release validates provenance publishing.

## Architecture Decisions

- **No public API change.** All work is CI config, internal robustness, or tests.
  `CompressOptions` and the two entry points stay as shipped in 0.1.0.
- **Packaging guards are CI-only** (`attw`, `publint`) — dev dependencies, never
  shipped. Sourcemaps dropped from the tarball via tsup/`files` so the published
  package is leaner; sourcemaps remain available in local dev builds.
- **Robustness fixes reuse the existing single-pass walker** — extend the established
  try/catch + marker pattern to Map/Set/array reads rather than adding a second pass.
- **CI matrices** run the existing scripts under multiple Node/React versions; the
  React matrix installs the target React version before running `src/react` tests.

## Technical Approach

### Frontend Components

- React hook test matrix (17/18/19) — same `renderHook` tests, version-swapped.

### Backend Services

- None.

### Infrastructure

- `.github/workflows/ci.yml`: add `attw`/`publint` steps + Node `18/20/22` matrix +
  a React `17/18/19` job. `package.json`/`tsup.config.ts`: drop published sourcemaps.

## Implementation Strategy

Two independent chains so work can parallelize: the **CI chain** (001 packaging guards
→ 002 matrices, sequenced because both edit `ci.yml`) and the **code chain** (003
robustness hardening → 004 edge-case tests, sequenced because tests cover 003's
changes). After all four merge to `develop`, cut the `0.2.0` release (release branch
→ `main` → `v0.2.0` tag → provenance publish → back-merge).

## Task Breakdown Preview

- **001** Packaging guards (`attw` + `publint` in CI) + trim published sourcemaps.
- **002** CI matrices — Node `18/20/22` + React `17/18/19` hook tests. _(depends 001)_
- **003** Robustness hardening — Proxy-safe Map/Set/array reads, `Date` deep-copy,
  `redactedValue` coercion, dev-warning when redaction disabled.
- **004** Edge-case test backfill — null-proto, RegExp/Error/TypedArray, `maxArrayLength: 0`,
  `dropEmpty` × markers. _(depends 003)_

## Dependencies

- External: `@arethetypeswrong/cli`, `publint` (dev). Internal: 002→001, 004→003.

## Success Criteria (Technical)

- `attw`/`publint` green and catch a broken exports map; CI matrix green on all
  Node/React versions; Proxy/throwing inputs never crash; tarball ships no sourcemaps;
  coverage ≥ 90%; `0.2.0` published with provenance.

## Estimated Effort

~9 hours across 4 tasks (see per-task `Hours:`), plus the release promotion.

## Tasks Created

- [ ] 001.md - Packaging guards + sourcemap trim (parallel: true)
- [ ] 002.md - CI version matrices (parallel: false)
- [ ] 003.md - Robustness hardening (parallel: true)
- [ ] 004.md - Edge-case test backfill (parallel: false)

Total tasks: 4
Parallel tasks: 2 (001, 003 — independent chains)
Sequential tasks: 2 (002 after 001; 004 after 003)
Estimated total effort: 9 hours
