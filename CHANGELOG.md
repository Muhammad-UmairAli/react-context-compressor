# react-context-compressor

## 0.2.1

### Patch Changes

- docs: add a demo GIF to the README illustrating what `compress()` does (large app
  state → minimal, secret-free LLM payload).

## 0.2.0

### Minor Changes

- Hardening release.

  - **Packaging:** `attw` + `publint` guards in CI; sourcemaps no longer shipped in the
    published tarball (leaner install).
  - **Compatibility:** CI tests Node 20/22 (+ a Node 18 runtime smoke) and React 17/18/19.
  - **Robustness:** Proxy-backed / throwing `Map`/`Set`/array inputs degrade to a marker
    instead of crashing; `Date` is deep-copied; `redactedValue` is string-coerced; a
    dev-only warning fires when redaction is fully disabled.
  - **Richer value shapes:** `RegExp` → source string, `Error` → `{ name, message }`,
    `TypedArray` → number array.

  No breaking API changes.

## 0.1.0

### Minor Changes

- Initial public release. A zero-dependency, mechanical core (`compress`) that
  caps depth, strips/redacts keys, caps arrays, drops empties, and is safe against
  circular references, throwing getters, and deep/untrusted input. Client-side
  sanitization with a tuned built-in deny-list (redact or remove). A memoized React
  hook `useCompressedContext` in the `./react` entry (SSR/RSC-safe, React 17/18/19).
  ESM + CJS + types; no network, no models.
