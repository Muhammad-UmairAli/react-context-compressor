/**
 * Internal helper for the React hook: turn a {@link CompressOptions} object into
 * a stable string signature so an inline options literal (new reference every
 * render) doesn't thrash `useMemo`. Not part of the public `./react` API.
 */
import type { CompressOptions } from "../index";

// Control-char delimiters that cannot appear unescaped in a JSON-encoded token,
// so neither matcher contents nor free-text option values can forge a boundary.
const FIELD = "\u0001";
const ITEM = "\u0000";

/** Unambiguous, collision-free key for one matcher (string or RegExp). */
function matcherKey(m: string | RegExp): string {
  return typeof m === "string"
    ? `s:${JSON.stringify(m)}`
    : `r:${JSON.stringify(m.source)}:${m.flags}`;
}

/**
 * Build a stable signature from an options object. Two options objects with
 * equal content produce the same signature; any content difference (including
 * RegExp flags, matcher order, or `Infinity` vs unset) produces a different one.
 */
export function optionsSignature(o: CompressOptions): string {
  return [
    `d=${o.maxDepth ?? ""}`,
    `a=${o.maxArrayLength ?? ""}`,
    `e=${o.dropEmpty ?? ""}`,
    `ds=${o.defaultSanitize ?? ""}`,
    `sm=${o.sanitizeMode ?? ""}`,
    `rv=${JSON.stringify(o.redactedValue ?? "")}`,
    `st=${(o.strip ?? []).map(matcherKey).join(ITEM)}`,
    `sn=${(o.sanitize ?? []).map(matcherKey).join(ITEM)}`,
  ].join(FIELD);
}
