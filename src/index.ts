/**
 * react-context-compressor — core entry (framework-agnostic, zero dependencies).
 *
 * Mechanical compression lands here (task 002); sanitization composes into the
 * same walk in task 003.
 */

import { compressCore } from "./core/compress";

/**
 * Options controlling how a state value is mechanically compressed and
 * sanitized into a minimal, LLM-ready payload. All fields are optional;
 * `compress(state)` with no options returns a safe deep copy.
 */
export interface CompressOptions {
  /**
   * Maximum object/array depth to retain. Nodes deeper than this are replaced
   * with a `"[Object]"` / `"[Array]"` marker. Default: `100` (a safe cap that
   * keeps payloads minimal and prevents stack overflow on pathologically deep
   * input). Set to `Infinity` to disable depth capping.
   */
  maxDepth?: number;
  /**
   * Maximum array length to retain. Longer arrays are truncated and a
   * `"[+N more]"` marker is appended. Default: unlimited.
   */
  maxArrayLength?: number;
  /** Keys (exact strings or patterns) to strip from the output. */
  strip?: Array<string | RegExp>;
  /** When true, drop `null` / `undefined` / `""` / `[]` / `{}` values. */
  dropEmpty?: boolean;
  /**
   * Extra sensitive field-name matchers to redact/remove, IN ADDITION to the
   * built-in deny-list (unless {@link CompressOptions.defaultSanitize} is
   * `false`). A `string` matches a key case-insensitively and exactly; a
   * `RegExp` matches by pattern. Matching is by field NAME, not value.
   */
  sanitize?: Array<string | RegExp>;
  /**
   * Apply the built-in sensitive-field deny-list (password, token, secret,
   * apiKey, authorization, cookie, ssn, creditCard, …). Default: `true`.
   * Set `false` to rely solely on {@link CompressOptions.sanitize}.
   */
  defaultSanitize?: boolean;
  /**
   * How to treat a sensitive field: `"redact"` replaces its value with
   * {@link CompressOptions.redactedValue}; `"remove"` drops the key entirely.
   * Either way the value is never read or emitted. Default: `"redact"`.
   */
  sanitizeMode?: "redact" | "remove";
  /** Replacement used when `sanitizeMode` is `"redact"`. Default: `"[REDACTED]"`. */
  redactedValue?: string;
}

/**
 * Mechanically compress and sanitize a state value into a minimal, safe payload.
 *
 * Pure and deterministic: the same input and options always produce the same
 * output, and the input is never mutated. Performs no I/O — purely structural.
 */
export function compress<T>(state: T, options: CompressOptions = {}): unknown {
  return compressCore(state, options);
}
