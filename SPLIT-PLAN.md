# SPLIT-PLAN.md

The spine of this project. Every phase, every deferred item, every cross-cutting concept lives here or in a doc this points at. If it isn't on the spine, it doesn't exist.

> See `docs/methodology/01-orchestration-spine.md` for how to use this document.

---

## §0 — Header

<!-- One paragraph describing the project and its current state of the world. Update at every phase boundary. -->

_Project: `<your-project-name>`. Current state: Phase 0 — Project Init complete. Phase 1 not yet started._

---

## §1 — Goals

<!-- What this project is trying to achieve. Stable; rarely edited. -->

- A lightweight React utility that automatically strips non-essential UI data and deep nesting from application state, converting it into a minimal payload for LLMs — drastically lowering AI token costs and preventing oversized data structures from breaking the AI's context window.
- Client-side data safety: explicitly sanitize and block sensitive fields (user tokens, credentials, internal private IDs) before they ever leak across the network boundary to an external LLM.

---

## §2 — Out of scope

<!-- What this project is NOT. Defended actively. -->

- No semantic or AI-powered text summarization. The library stays a 100% mechanical, zero-cost, client-side JavaScript object parser — no network calls, no local SLMs (Small Language Models) to "summarize" data, since that would defeat the purpose of being ultra-lightweight and saving money before the network layer.

---

## §3 — Architecture overview

<!-- Pointer to docs/architecture-design-decisions.md. Don't duplicate decisions here. -->

See [`docs/architecture-design-decisions.md`](docs/architecture-design-decisions.md) for current architecture and decision history.

---

## §4 — Cross-cutting concepts

<!-- Names and values that must update in EVERY affected file when changed. When editing one of these, walk every row and update every file in it. -->

| Concept                       | Files that must agree                                                                  |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| _e.g. canonical project name_ | `README.md`, `CLAUDE.md`, `docs/DESIGN.md`                                             |
| `docs/DESIGN.md`              | Visual identity — Binance, BMW M, Airbnb, Airtable; theme picker mandate for VoltAgent |

---

## §5 — Progress log

<!-- One-line pointer rows, one per closed phase. Full closure detail lives in docs/phases/phase-NNN.md for non-trivial phases. -->

| Date       | Phase                             | What was done                                                                | What is next                                |
| ---------- | --------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------- |
| 2026-06-17 | Phase 0 — Project Init            | Bootstrap via `init-project.sh`. See `TIME-LOG.md` Phase 0 rows for actuals. | Define SPLIT-PLAN §1 (goals); open Phase 1. |
| 2026-06-17 | Phase 1 — compress-state-for-llms | IN FLIGHT                                                                    | (will be filled in at close)                |

---

## §6 — Backlog

<!--
Items deliberately deferred from in-flight phases.

Three rules:
1. A future phase that picks up an item: adds a SPLIT-PLAN §5 (progress log) row referencing SPLIT-PLAN §6 (backlog), addresses ONLY the chosen item, REMOVES the bullet from SPLIT-PLAN §6 (backlog).
2. New deferred items added only when a phase explicitly defers something. No hypotheticals.
3. SPLIT-PLAN §6 (backlog) is never modified by an unrelated phase. Stop and ask if tempted.
-->

Deferred from Phase 1 task 001 (scaffold) code review — advisory findings:

- **CI: guard packaging with `@arethetypeswrong/cli` + `publint`.** Add an `attw --pack` / `publint` step so exports-map / type-resolution regressions are caught automatically as real code lands in tasks 002–004.
- **CI: Node version matrix.** CI pins Node 20 but `engines.node` is `>=18`; add an `18 / 20 / 22` matrix to validate the stated floor.
- **size-limit: add a CJS budget line.** Only the two ESM entries are size-gated; the React CJS bundle inlines the core. Add a CJS line once real logic exists.
- **Revisit `tsconfig.json` `ignoreDeprecations: "6.0"`.** Added to silence TS6's `baseUrl` deprecation (injected by tsup's dts build). Confirm it's still needed / not masking a real deprecation when tooling updates.
- **Document peer-dependency intent.** `react` is an optional peer (core works React-free; `./react` requires React) — document this so `optional: true` isn't read as "React never needed".

Deferred from Phase 1 task 002 (core compression) code review — advisory findings (blocking B1–B3 + advisory A1 were fixed in the task PR):

- **Map key stringify collisions (A2).** `Map` keys are coerced via `String(k)`, so distinct keys (`1` vs `"1"`, two object keys) silently collapse last-write-wins. Document the limitation and consider collision detection.
- **Non-plain built-ins flatten surprisingly (A3).** RegExp/Error/TypedArray/URL/WeakMap fall through the class-instance branch (`/re/ → {}`, `Error → {}`, `Uint8Array → {"0":…}`). Add explicit handling (e.g. `String(regexp)`, `{name,message}` for Error) and document which built-ins are normalized.
- **`maxArrayLength: 0` edge (A4).** Yields `["[+N more]"]` (length 1) when the cap is 0. Decide/document whether the marker should count against a zero cap.
- **Array extra (non-index) props dropped (A5).** `arr.extra = "x"` is lost (matches `JSON.stringify`). One-sentence doc note.
- **`dropEmpty` × markers test (A6).** Truncation/`[Circular]` markers are correctly kept (non-empty strings); add a confirming test to pin the interaction.
- **Edge-case test coverage (A7).** Add backlog tests for null-prototype objects, RegExp/Error/TypedArray values, and `maxArrayLength: 0`.

Deferred from Phase 1 task 002 security audit — no Critical/High; prototype-pollution fix confirmed sound; Medium (deep-recursion DoS) fixed in the PR via a safe default `maxDepth: 100`. Remaining (Low):

- **Throwing getter uncaught in Map/Set iteration + array reads (Finding 3).** The try/catch only wraps object property reads; a Proxy-backed Map/Set/array whose access throws still aborts the walk. Extend the guard to those reads.
- **ReDoS via user `RegExp` in `strip`/`sanitize` (Finding 5).** Consumer-supplied patterns run against every key; catastrophic backtracking + a long key can hang. Document "avoid nested quantifiers"; optionally cap key length before `test()`. (Consumer-controlled config, so Low.)
- **`Date` returned by reference (Finding 6).** `instanceof Date` returns the same instance; mutating the returned Date mutates the input's. Return `new Date(value.getTime())` for a true copy.
- **Task 003 forward-note (Finding 7).** The compression layer is key-name-driven and only sees own enumerable string keys: Symbol-keyed/non-enumerable secrets are dropped structurally (not by rule), getters are evaluated (their values materialize), and `strip` never matches on values. `sanitize` (003) must be value-aware where needed and not assume key-rules cover Symbol/getter-sourced secrets.

Deferred from Phase 1 task 003 (sanitization) code review + security audit — no Critical; all High (B1/B2 deny-list false positives, F2 false-negatives, F3 Unicode/zero-width evasion) fixed in the task PR. Remaining (Low/Medium):

- **Throwing getter / Proxy in Map/Set iteration + array reads (sec F1/Finding 3).** Same gap as task 002: the try/catch covers object property reads only. Extend to Map/Set iteration and array element reads.
- **Homoglyph confusables (sec F3 residual).** NFKC + zero-width stripping defeats fullwidth/zero-width evasion but not deliberate Cyrillic/Greek look-alike keys. A confusables map would close it; documented as a known residual.
- **`redactedValue` runtime coercion (review A2).** Typed `string` but a JS caller could pass a non-string (e.g. `0`), which is emitted verbatim. Coerce via `String(...)` in `resolveOptions` or document.
- **Dev-mode warning when redaction fully disabled (sec F8).** `defaultSanitize:false` + empty `sanitize` silently turns off all redaction; emit a `console.warn` in dev.
- **Optional key-length cap before matching (sec F7).** Defense-in-depth against ReDoS from consumer patterns over very long (e.g. Map-coerced) keys.
- **Lower-signal deny-list additions.** `salt`, `hash`, `clientId`, `cert`/`pem` — higher false-positive risk; evaluate before adding.

Deferred from Phase 1 task 004 (React hook) code review — blocking B1 (signature collision) fixed in PR:

- **Cross-version React test matrix (A5).** Only React 19 is installed/tested; 17/18 compatibility rests on the `useMemo`-only surface. Pin with a React 17/18/19 matrix test if desired.
