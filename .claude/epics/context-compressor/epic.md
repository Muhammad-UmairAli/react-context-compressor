---
name: context-compressor
status: backlog
created: 2026-06-17T14:00:13Z
progress: 40%
prd: .claude/prds/context-compressor.md
github: (will be set on sync)
---

# Epic: context-compressor

## Overview

Build `react-context-compressor` as a single npm package with two entry points: a
zero-dependency framework-agnostic core (`.`) and a thin React bindings layer
(`./react`). The core does mechanical compression + sanitization of a state object;
the React layer is one memoized hook on top of it. Toolchain is Stack 1
("tsup + Pure Hook"): tsup build → ESM+CJS+`.d.ts`, Vitest, Biome, Changesets,
size-limit. Work is sequenced scaffold → core compress → core sanitize → React hook
→ docs.

## Architecture Decisions

- **Single package, subpath exports.** `package.json` `exports` map: `.` → core,
  `./react` → bindings. `sideEffects: false`. Avoids monorepo overhead at this scope;
  consumers tree-shake the React layer away if unused.
- **Core has no React import.** The React entry imports `useMemo`/`useRef` from the
  `react` peer dep and calls the core. Keeps the root entry truly zero-dependency.
- **tsup (esbuild) for build**, emitting ESM + CJS + bundled declarations. If complex
  generics produce noisy `.d.ts`, fall back to a `rollup-plugin-dts` post-step (noted,
  not pre-emptively added).
- **Mechanical, deterministic traversal.** A single recursive walker applies depth
  capping, key stripping, array capping, empty-dropping, and sanitization in one pass,
  with circular-reference protection via a visited set.
- **Sanitization is part of the walk, default deny-list included.** Matching is by
  exact key and `RegExp`; matched fields are removed or redacted. Security-sensitive,
  so this task gets a dedicated security audit.
- **Options are a single typed object** shared by core and hook; sensible defaults so
  `compress(state)` works with no config.
- **Pure hook API** (`useCompressedContext`) — no provider, no context, no external
  store shim → React 17/18/19 + SSR/RSC safe.

## Technical Approach

### Frontend Components

- `./react` entry: `useCompressedContext(state, options)` — `useMemo` over `compress`,
  with a stable options ref via `useRef`. No DOM access; SSR/RSC safe.
- Tested with `@testing-library/react` + Vitest (jsdom).

### Backend Services

- None. Pure client-side library; no server, transport, or network surface.

### Infrastructure

- tsup build config; `tsconfig` (`strict`, `isolatedModules`, `moduleResolution: bundler`,
  `declaration`); Vitest config + coverage; Biome config; Changesets; GitHub Actions CI
  (typecheck → lint → test+coverage → build → size-limit) + publish workflow with
  provenance.

## Implementation Strategy

Sequential, smallest-viable-first. Scaffold lands the toolchain and empty entry points
so every later task has a green build, lint, and test command. Core compression and
core sanitization are built as separate modules (`compress.ts`, `sanitize.ts`) composed
by the public `compress()`; they can be developed in parallel once the scaffold exists,
but sanitize depends on the traversal contract from compress, so we sequence them to
avoid churn. React bindings come after the core is stable. Docs/examples last, once the
public API is frozen.

## Task Breakdown Preview

- **001** Scaffold + toolchain (package.json subpath exports, tsup, tsconfig, Vitest,
  Biome, Changesets, size-limit, CI). Setup. _(blocks everything)_
- **002** Core compression engine (`compress()`: depth cap, key strip, array cap,
  empty-drop, circular safety) + types + tests. _(depends 001)_
- **003** Core sanitization (default deny-list, exact + regex matchers, redact/remove,
  nested + in-array, no-leak tests) + security audit. _(depends 002)_
- **004** React bindings (`useCompressedContext` memoized hook, `./react` entry) +
  tests. _(depends 002, 003)_
- **005** Docs, README, runnable example, bundle-size badge. _(depends 004)_

## Dependencies

- External: tsup, vitest, @vitest/coverage-v8, @biomejs/biome, @changesets/cli,
  size-limit (all dev deps); `react` peer dep; GitHub Actions.
- Internal: 002→001, 003→002, 004→{002,003}, 005→004.

## Success Criteria (Technical)

- `npm run build` emits ESM + CJS + `.d.ts` for both entry points.
- `npm ls --prod` shows zero runtime dependencies.
- Core coverage ≥ 90%; no-leak sanitization test passes across the matrix.
- size-limit budget enforced in CI and currently green.
- Hook recomputes only on `state`/options change (verified by render-count test).

## Estimated Effort

~16 hours total across 5 tasks (see per-task `Hours:`). Serial floor (longest chain
001→002→003→004→005) is the critical path; 002/003 share the core module so are
sequenced rather than parallelized.

## Tasks Created

- [x] 001.md - Scaffold + toolchain (parallel: false)
- [x] 002.md - Core compression engine (parallel: false)
- [ ] 003.md - Core sanitization + security audit (parallel: false)
- [ ] 004.md - React bindings hook (parallel: false)
- [ ] 005.md - Docs, README, example (parallel: false)

Total tasks: 5
Parallel tasks: 0
Sequential tasks: 5
Estimated total effort: 16 hours
