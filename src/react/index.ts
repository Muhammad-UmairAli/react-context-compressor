/**
 * react-context-compressor — React bindings entry.
 *
 * Imports only from the core entry and the `react` peer dependency, so the
 * core (`.`) entry stays React-free. The memoization contract is finalized in
 * task 004.
 */
import { useMemo } from "react";
import { type CompressOptions, compress } from "../index";

/**
 * React hook returning a memoized, compressed + sanitized view of `state`.
 *
 * STUB (task 001): delegates to the core `compress` stub. Stable-options
 * handling and the full memoization contract land in task 004.
 */
export function useCompressedContext<T>(state: T, options: CompressOptions = {}): unknown {
  return useMemo(() => compress(state, options), [state, options]);
}

export type { CompressOptions };
