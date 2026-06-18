---
name: hardening
description: Release-quality hardening pass for react-context-compressor (0.2.0) — packaging guards, CI matrices, robustness, edge-case coverage
status: backlog
created: 2026-06-18T15:49:59Z
---

# PRD: hardening

## Executive Summary

A hardening pass over the shipped `react-context-compressor` (0.1.0): add automated
packaging/regression guards, broaden CI to the Node and React versions we claim to
support, close the residual robustness gaps surfaced by the Phase 1 code reviews and
security audits, and backfill edge-case test coverage. Ships as `0.2.0` — the first
release published with provenance via the now-configured `NPM_TOKEN`.

## Problem Statement

0.1.0 is correct and well-tested, but several Phase 1 review findings were
consciously deferred to SPLIT-PLAN §6 (backlog): packaging is unguarded against
exports/types regressions, CI tests only one Node version and one React version
despite the `>=18` / `>=17` claims, a few robustness gaps remain (Proxy-backed
iteration can throw, `Date` is returned by reference, redaction can be silently
disabled), and some edge cases lack tests. None are user-facing bugs today, but they
are the difference between "works" and "trustworthy library."

## User Stories

- **As a maintainer**, I want CI to fail when the package's exports map or type
  resolution breaks, so a bad publish is caught before release.
  - _Acceptance:_ `attw` + `publint` run in CI and fail on a deliberately broken exports map.
- **As a consumer on Node 18 or React 17**, I want assurance the library actually
  works on the versions the README claims.
  - _Acceptance:_ CI green across a Node `18/20/22` matrix and a React `17/18/19` hook-test matrix.
- **As a security-conscious consumer**, I want compression to never crash on hostile
  inputs and never silently disable redaction.
  - _Acceptance:_ Proxy/throwing Map/Set/array reads degrade gracefully; a dev-mode
    warning fires when redaction is fully disabled.

## Functional Requirements

1. **Packaging guards (CI):** add `@arethetypeswrong/cli` (`attw --pack`) and
   `publint` as CI steps; exclude sourcemaps from the published tarball (keep the
   bundle lean) without breaking debugging in dev.
2. **CI matrices:** Node `18/20/22` for the build job; a React `17/18/19` matrix for
   the hook tests (install the matrixed React version and run `src/react` tests).
3. **Robustness hardening:**
   - Wrap Map/Set iteration and array element reads in the same try/catch the object
     path already uses (Proxy/throwing source degrades to a marker, never crashes).
   - Deep-copy `Date` (`new Date(value.getTime())`) so the output never shares a live
     reference with the input.
   - Coerce `redactedValue` to a string in `resolveOptions` (defend JS callers).
   - Emit a `console.warn` (dev only) when `defaultSanitize:false` and `sanitize` is
     empty (redaction fully disabled).
4. **Edge-case coverage:** add tests for null-prototype objects, `RegExp`/`Error`/
   `TypedArray` values, `maxArrayLength: 0`, and the `dropEmpty` × markers interaction.

## Non-Functional Requirements

- No new runtime dependencies; `attw`/`publint` are dev/CI only. Bundle stays within
  the size-limit budget. Public API unchanged (additive/internal only).
- Coverage stays ≥ 90% on core + sanitize. All changes mechanical (no network/models).
- Backward compatible: 0.1.0 consumers see no behavior change except the documented
  robustness fixes.

## Success Criteria

- `attw` + `publint` green in CI and demonstrably catch a broken exports map.
- CI green across Node 18/20/22 and React 17/18/19.
- Proxy/throwing Map/Set/array inputs produce a marker, never throw (tested).
- Published tarball no longer ships sourcemaps; size-limit still green.
- `0.2.0` published to npm **with provenance** (validates the `NPM_TOKEN` setup).

## Constraints & Assumptions

- Same toolchain as 0.1.0 (tsup/Vitest/Biome/Changesets/size-limit). No API redesign.
- Trusted publishing/`NPM_TOKEN` is configured (Phase 2 is the first release to use it).

## Out of Scope

- Value-based sanitization (scanning values, not just key names) — a possible future
  spike only; the library remains key-name-driven (SPLIT-PLAN §2 (out of scope)).
- New framework adapters (Vue/Solid), tokenizer integration, or any network/model work.
- Homoglyph/confusables defense beyond the existing NFKC + zero-width normalization.

## Dependencies

- Built on the shipped 0.1.0 core/sanitize/react modules.
- `NPM_TOKEN` secret (configured) for the provenance publish.
- Dev deps to add: `@arethetypeswrong/cli`, `publint`.
