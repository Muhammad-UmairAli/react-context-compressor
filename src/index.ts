/**
 * react-context-compressor — core entry (framework-agnostic, zero dependencies).
 *
 * This is the typed scaffold from task 001. The mechanical compression walker
 * lands in task 002 and sanitization in task 003.
 */

/**
 * Options controlling how a state value is mechanically compressed and
 * sanitized into a minimal, LLM-ready payload.
 */
export interface CompressOptions {
  /** Maximum object/array depth to retain before truncating deeper nodes. */
  maxDepth?: number;
  /** Maximum array length to retain before eliding the remainder. */
  maxArrayLength?: number;
  /** Keys (exact strings or patterns) to strip from the output. */
  strip?: Array<string | RegExp>;
  /** When true, drop `null` / `undefined` / `""` / `[]` / `{}` values. */
  dropEmpty?: boolean;
  /** Sensitive field matchers (exact strings or patterns) to redact or remove. */
  sanitize?: Array<string | RegExp>;
}

/**
 * Mechanically compress and sanitize a state value into a minimal, safe payload.
 *
 * STUB (task 001): returns the input unchanged. Compression logic arrives in
 * task 002 and sanitization in task 003; the signature is stable.
 */
export function compress<T>(state: T, _options: CompressOptions = {}): unknown {
  return state;
}
