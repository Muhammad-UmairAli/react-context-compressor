# Phase 2 — hardening-release-quality

**Date opened:** 2026-06-18
**Status:** CLOSED (2026-06-19)

## Scope

Release-quality hardening of `react-context-compressor` from SPLIT-PLAN §6 (backlog):
packaging guards, CI version matrices, robustness against hostile inputs, and
edge-case coverage. Ships as `0.2.0` — the first release published with provenance
via the configured `NPM_TOKEN`.

## Deliverables

- [x] Mergeable PR(s) closing the linked GitHub Issue(s)
- [x] TIME-LOG.md rows logged for each substantive step (via /log-time)
- [x] DASHBOARD.html updated with rows for every step (auto via /log-time)
- [x] Closure log appended below at phase close

## Plan

CCPM epic `hardening`, two parallel chains:

- [x] **001** Packaging guards (attw + publint) + sourcemap trim — PR #19
- [x] **002** CI version matrices (Node 20/22 + Node-18 smoke; React 17/18/19) — PR #24
- [x] **003** Robustness hardening (proxy-safe reads, Date copy, coercion, dev-warn) — PR #20
- [x] **004** Edge-case backfill + RegExp/Error/TypedArray shapes — PR #25

(Round 1 = 001 + 003 in parallel git worktrees; round 2 = 002 + 004.)

## Closure log

**Closed:** 2026-06-19

### What shipped (→ 0.2.0)

- **Packaging guards (001):** `@arethetypeswrong/cli` + `publint` in CI; published
  tarball trimmed of sourcemaps (17→12 files, 111→39 kB).
- **CI matrices (002):** full suite on Node 20/22 + a Node-18 runtime import-smoke
  (Vitest 4 needs Node ≥20.12, so the suite can't run on 18; the shipped build is
  validated to load + redact on 18). React 17/18/19 validated via a version-agnostic
  `react-dom/server` SSR smoke test (RTL `renderHook` needs React 18+).
- **Robustness (003):** Proxy/throwing Map/Set/array reads degrade to `[Getter]`
  (never crash); `Date` deep-copied; `redactedValue` string-coerced; dev-only warning
  when redaction is fully disabled.
- **Edge cases (004):** null-proto / `maxArrayLength:0` / `dropEmpty`×markers pinned;
  `RegExp → source string`, `Error → {name,message}` (re-walked through sanitize),
  `TypedArray → number array` — all crash-safe.

### Issues / PRs

- Issues #17, #18, #22, #23 (closed manually — Git Flow merges target `develop`).
- PRs merged to `develop`: #16 (decomposition), #19, #20, #21 (round-1 bookkeeping),
  #24, #25.

### Quality gates

- 151 tests; coverage 98.7% statements / 98.5% branches (≥90% gate). Bundle: core
  ~1.59 kB / react ~1.86 kB gzip (under the 3 kB / 2 kB budgets — react margin is
  tightening, noted in SPLIT-PLAN §6 (backlog)). CI green across Node 20/22, React
  17/18/19, Node-18 smoke, attw/publint, pre-commit.
- Code review on all four tasks; **security audit** on 003 and on the 004
  value-emission change. Blocking findings fixed in-PR: Node-18/Vitest-styleText CI
  failure, and the Error-getter crash (B1). Advisories deferred to SPLIT-PLAN §6 (backlog).

### Process note

Round-1 tasks (001, 003) ran in parallel git worktrees per the chosen mode. Round-2
worktree agents (002, 004) hit a session limit and produced nothing, so those two
were completed directly in the main tree — still as separate PRs with full review +
security gates. Net parallelism was partial; correctness/gates were preserved.

### Files / areas NOT touched

- Library public API (`compress` / `CompressOptions` / `useCompressedContext`) is
  unchanged — all work was CI, internal robustness, tests, or output-shape additions.
- `docs/methodology/*`, `DASHBOARD.html` theming, `.github/rulesets/*`, observability,
  `sandboxes/` — untouched.

### What this unblocks

- The `0.2.0` release (release/0.2.0 → main → `v0.2.0` tag → CI provenance publish).
- Remaining SPLIT-PLAN §6 (backlog) hardening (Proxy-iteration getters, homoglyphs,
  dev-warn latch, CI hygiene, size-budget review, value-aware sanitize spike).

**Closed:** 2026-06-19

Hardening pass complete — packaging guards (attw/publint) + sourcemap trim, Node 20/22 + Node-18-smoke + React 17/18/19 CI matrices, proxy-safe/robustness hardening, edge-case backfill + RegExp/Error/TypedArray shapes. Tasks 001-004 merged (PRs #19/#20/#24/#25); 151 tests, 98.7%/98.5% cov. Ready for 0.2.0 release.
