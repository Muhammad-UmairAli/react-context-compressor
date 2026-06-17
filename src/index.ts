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
   * Sensitive field matchers (exact strings or patterns) to redact or remove.
   * Applied in task 003; accepted here for a stable options shape.
   */
  sanitize?: Array<string | RegExp>;
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
