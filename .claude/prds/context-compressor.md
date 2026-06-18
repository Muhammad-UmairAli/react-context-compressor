---
name: context-compressor
description: Mechanical client-side compressor + sanitizer that turns React/JS app state into a minimal, safe LLM payload
status: backlog
created: 2026-06-17T14:00:13Z
---

# PRD: context-compressor

## Executive Summary

`react-context-compressor` is a lightweight, zero-dependency JavaScript/TypeScript
library that mechanically transforms an application's state object into a minimal,
safe payload suitable for sending to a Large Language Model (LLM). It strips
non-essential UI data and deep nesting to cut token costs and avoid context-window
overflows, and it sanitizes sensitive fields (tokens, credentials, private IDs)
before that data can cross the network boundary to an external model. It ships a
framework-agnostic core plus a thin React bindings layer (`useCompressedContext`),
and performs 100% mechanical object parsing — no network calls, no models.

## Problem Statement

Developers building AI/LLM features routinely serialize large slices of application
state and send them to a model. This is expensive (tokens are billed per character)
and fragile (oversized structures blow past the context window and the request
fails). State objects are also full of data the model does not need — UI flags,
memoized caches, deeply nested view models — and, worse, sometimes carry secrets
(auth tokens, API keys, internal IDs) that must never leave the client. Today each
team re-invents an ad-hoc `JSON.stringify`-and-prune step, with no consistent
guarantee that secrets are stripped. There is no small, mechanical, client-side
utility that does both the shrinking and the sanitizing predictably and cheaply.

## User Stories

- **As a React developer integrating an LLM**, I want to pass my component/store
  state to a hook and get back a small object, so that I lower my token bill without
  hand-writing pruning logic.
  - _Acceptance:_ `useCompressedContext(state, options)` returns a plain object whose
    serialized size is materially smaller than the input for representative state.

- **As a security-conscious developer**, I want to declare which fields are sensitive
  (by exact key, by pattern, or by a default deny-list) and have them removed or
  redacted, so that no token or credential is ever sent to an external LLM.
  - _Acceptance:_ configured sensitive keys never appear (by key or value) in the
    output, including when nested arbitrarily deep; a test asserts zero leakage.

- **As a library author / non-React user**, I want the compression core with no React
  dependency, so that I can use it in a worker, a Node script, or another framework.
  - _Acceptance:_ importing the root entry pulls in zero runtime dependencies and no
    React code.

- **As a performance-sensitive developer**, I want the React hook to be memoized, so
  that compression only re-runs when state actually changes.
  - _Acceptance:_ the hook recomputes only when the `state` reference or options change.

## Functional Requirements

1. **Compression core** — a `compress(state, options)` function that:
   - Limits object depth to a configurable `maxDepth`; nodes beyond it are truncated
     to a placeholder rather than recursed.
   - Strips keys named in a `strip` list (exact keys and patterns).
   - Optionally drops empty values (`null`/`undefined`/`""`/`[]`/`{}`) via a flag.
   - Caps array length to a configurable `maxArrayLength`, recording how many were
     elided.
   - Is purely mechanical and deterministic — same input + options yields same output.
2. **Sanitization** — a `sanitize` capability (composed into `compress`) that:
   - Accepts a list of sensitive field matchers: exact strings and `RegExp`.
   - Ships a sensible **default deny-list** (e.g. `token`, `password`, `secret`,
     `apiKey`, `authorization`, `creditCard`, `ssn`) that can be extended or replaced.
   - Removes or redacts (`"[REDACTED]"`) matched fields at any nesting depth, including
     inside arrays.
   - Never emits a matched key or its value in the output.
3. **React bindings** — a `useCompressedContext(state, options)` hook exported from the
   `./react` entry point that wraps the core and memoizes the result.
4. **Configuration** — a single `options` object shared by core and hook, fully typed.
5. **Safe traversal** — handles circular references without throwing (replaces the
   back-reference with a marker), and leaves non-plain values (Date, Map, etc.) in a
   documented, predictable form.

## Non-Functional Requirements

- **Toolchain (confirmed — Stack 1 "tsup + Pure Hook"):**
  - Build: **tsup** (esbuild) emitting **ESM + CJS + `.d.ts`**.
  - Tests: **Vitest** + `@vitest/coverage-v8` (coverage gate ≥ 90% on core).
  - Lint/format: **Biome**.
  - Versioning/publish: **Changesets**, npm **provenance**.
  - Bundle budget: **size-limit** in CI (core ≤ ~3 kB gzip, react ≤ ~1 kB gzip).
- **Zero runtime dependencies.** `react` is a **peer dependency** (>=17), never bundled.
- **Package layout:** single package with subpath exports — `.` (core, zero-dep) and
  `./react` (bindings); `sideEffects: false` for tree-shaking.
- **Compatibility:** React 17 / 18 / 19; SSR / React Server Components safe (no DOM,
  no side effects). Node + modern browsers.
- **Performance:** compression is O(n) in the number of state nodes; the hook adds no
  re-render beyond React's memoization.
- **Quality:** TypeScript `strict`, full public type definitions, no `any` in the
  public API.

## Success Criteria

- A representative nested state object is reduced by a measurable margin (target: ≥ 50%
  serialized-size reduction on the documented example fixture).
- 100% of configured sensitive fields are absent from output across the test matrix
  (exact key, regex, nested, in-array) — verified by an automated "no-leak" test.
- Published bundle stays within the size-limit budget; CI fails if exceeded.
- Test coverage ≥ 90% on the core module.
- Library installs with zero transitive runtime dependencies (`npm ls --prod` shows none).

## Constraints & Assumptions

- Pure client-side; no network calls and no local/remote models (mechanical only).
- The library does not understand semantics of the data — it prunes structurally and
  by field name/pattern, not by meaning.
- Consumers supply their own state snapshot; the library is agnostic to the state
  manager (Redux/Zustand/Context/useState).
- Assumes input is JSON-serializable-ish; non-serializable values are handled by
  documented fallbacks rather than deep support.

## Out of Scope

- **Any semantic or AI-powered summarization** of content — explicitly excluded
  (see SPLIT-PLAN §2 (out of scope)). No network calls, no SLMs/LLMs to "summarize".
- Token counting / tokenizer integration for specific model vocabularies.
- Server-side middleware, transport, or an HTTP client.
- Non-React framework adapters (Vue/Solid/Svelte) — possible future work, not v1.
- Persistence, caching layers, or a devtools UI.

## Dependencies

- Build/test/CI toolchain per the Non-Functional Requirements (dev dependencies only).
- `react` as a peer dependency for the `./react` entry point.
- GitHub Actions for CI and npm publish (provenance via OIDC).
