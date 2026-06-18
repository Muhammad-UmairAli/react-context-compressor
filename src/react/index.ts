/**
 * react-context-compressor — React bindings entry.
 *
 * Imports only from the core entry and the `react` peer dependency, so the
 * core (`.`) entry stays React-free and the React layer tree-shakes away for
 * consumers who import only `.`.
 */
import { useMemo } from "react";
import { type CompressOptions, compress } from "../index";
import { optionsSignature } from "./signature";

/**
 * React hook returning a memoized, compressed + sanitized view of `state`.
 *
 * Recomputes only when the `state` reference changes or the options content
 * changes (compared by a stable signature, so an inline options literal is
 * fine). Pure: no DOM access, no side effects — safe under SSR and React
 * Server Components. Works on React 17 / 18 / 19.
 */
export function useCompressedContext<T>(state: T, options: CompressOptions = {}): unknown {
  const signature = optionsSignature(options);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `options` is keyed by its stable `signature`
  return useMemo(() => compress(state, options), [state, signature]);
}

export type { CompressOptions };
