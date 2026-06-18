# react-context-compressor

## 0.1.0

### Minor Changes

- Initial public release. A zero-dependency, mechanical core (`compress`) that
  caps depth, strips/redacts keys, caps arrays, drops empties, and is safe against
  circular references, throwing getters, and deep/untrusted input. Client-side
  sanitization with a tuned built-in deny-list (redact or remove). A memoized React
  hook `useCompressedContext` in the `./react` entry (SSR/RSC-safe, React 17/18/19).
  ESM + CJS + types; no network, no models.
