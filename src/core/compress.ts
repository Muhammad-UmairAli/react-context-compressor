/**
 * Core compression walker — mechanical, deterministic, zero-dependency.
 *
 * A single recursive pass applies: key stripping, depth capping, array-length
 * capping, and empty-value dropping, with circular-reference protection.
 * Sanitization (task 003) composes into this same walk via {@link CompressOptions.sanitize}.
 */

import type { CompressOptions } from "../index";
import { isSensitiveKey, REDACTED, regexTest } from "./sanitize";

/** Marker substituted for a node that exceeds {@link CompressOptions.maxDepth}. */
export const TRUNCATED_OBJECT = "[Object]";
/** Marker substituted for an array that exceeds {@link CompressOptions.maxDepth}. */
export const TRUNCATED_ARRAY = "[Array]";
/** Marker substituted for a circular back-reference. */
export const CIRCULAR = "[Circular]";
/** Marker substituted for a property whose getter threw when read. */
export const GETTER_ERROR = "[Getter]";

/**
 * Safe default depth cap. Real application state is rarely deeper than a few
 * dozen levels; capping by default keeps payloads minimal and prevents a
 * stack-overflow DoS on pathologically deep (untrusted) input. Opt out with
 * `maxDepth: Infinity`.
 */
export const DEFAULT_MAX_DEPTH = 100;

/** Fully-resolved options after defaults are applied. */
interface ResolvedOptions {
  maxDepth: number;
  maxArrayLength: number;
  strip: Array<string | RegExp>;
  dropEmpty: boolean;
  sanitize: Array<string | RegExp>;
  defaultSanitize: boolean;
  sanitizeMode: "redact" | "remove";
  redactedValue: string;
}

const DEFAULTS: ResolvedOptions = {
  maxDepth: DEFAULT_MAX_DEPTH,
  maxArrayLength: Number.POSITIVE_INFINITY,
  strip: [],
  dropEmpty: false,
  sanitize: [],
  defaultSanitize: true,
  sanitizeMode: "redact",
  redactedValue: REDACTED,
};

/** A unique sentinel meaning "this value should be omitted from the output". */
const OMIT = Symbol("omit");

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Assign an own, enumerable data property — even for dangerous keys like
 * `__proto__` (a plain `out[key] = v` would reassign the prototype instead of
 * creating a property, corrupting the output and silently dropping the value).
 */
function safeAssign(target: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(target, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

/** Does `key` match any matcher (exact string or RegExp test)? */
export function keyMatches(key: string, matchers: ReadonlyArray<string | RegExp>): boolean {
  for (const matcher of matchers) {
    if (typeof matcher === "string") {
      if (matcher === key) return true;
    } else if (regexTest(matcher, key)) {
      return true;
    }
  }
  return false;
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  if (isPlainObject(value)) return Object.keys(value).length === 0;
  return false;
}

/**
 * Coerce a caller-supplied `redactedValue` to a string so a non-string passed
 * by a JS caller (bypassing the TS type) can never leak through as a raw value.
 * `String(x)` can itself throw on a hostile `toString`/`Symbol.toPrimitive`;
 * fall back to the default rather than crashing — `compress` must never throw.
 */
function coerceRedactedValue(value: unknown): string {
  if (value === null || value === undefined) return DEFAULTS.redactedValue;
  try {
    return String(value);
  } catch {
    return DEFAULTS.redactedValue;
  }
}

/**
 * Resolve user options against defaults. Exposed so the React layer and
 * sanitization can share one normalization path.
 */
export function resolveOptions(options: CompressOptions): ResolvedOptions {
  return {
    maxDepth: options.maxDepth ?? DEFAULTS.maxDepth,
    maxArrayLength: options.maxArrayLength ?? DEFAULTS.maxArrayLength,
    strip: options.strip ?? DEFAULTS.strip,
    dropEmpty: options.dropEmpty ?? DEFAULTS.dropEmpty,
    sanitize: options.sanitize ?? DEFAULTS.sanitize,
    defaultSanitize: options.defaultSanitize ?? DEFAULTS.defaultSanitize,
    sanitizeMode: options.sanitizeMode ?? DEFAULTS.sanitizeMode,
    redactedValue: coerceRedactedValue(options.redactedValue),
  };
}

/** Walk own enumerable string keys of an object-like value into `out`. */
function walkObjectInto(
  out: Record<string, unknown>,
  source: Record<string, unknown>,
  depth: number,
  opts: ResolvedOptions,
  seen: WeakSet<object>,
): void {
  for (const key of Object.keys(source)) {
    if (keyMatches(key, opts.strip)) continue;
    // Sanitize BEFORE reading the value: a sensitive value is never read
    // (no getter fired), never walked, and never reaches the output.
    if (isSensitiveKey(key, opts.sanitize, opts.defaultSanitize)) {
      if (opts.sanitizeMode === "remove") continue;
      safeAssign(out, key, opts.redactedValue);
      continue;
    }
    let raw: unknown;
    try {
      raw = source[key];
    } catch {
      // A getter threw — degrade to a marker rather than crashing the walk.
      safeAssign(out, key, GETTER_ERROR);
      continue;
    }
    const walked = walk(raw, depth + 1, opts, seen);
    if (walked === OMIT) continue;
    if (opts.dropEmpty && isEmptyValue(walked)) continue;
    safeAssign(out, key, walked);
  }
}

function walk(
  value: unknown,
  depth: number,
  opts: ResolvedOptions,
  seen: WeakSet<object>,
): unknown {
  if (value === null) return null;
  const type = typeof value;
  if (type === "function" || type === "symbol") return OMIT;
  // BigInt is not JSON-serializable; coerce to string for an LLM-ready payload.
  if (type === "bigint") return (value as bigint).toString();
  if (type !== "object") return value;

  // Circular-reference guard sits above all object normalization so a cycle
  // through a Map/Set is caught instead of overflowing the stack.
  const ref = value as object;
  if (seen.has(ref)) return CIRCULAR;

  // Non-plain objects we deliberately normalize for a predictable payload.
  // Date is deep-copied so the output never shares a live reference with the
  // input (mutating the returned Date can't reach back into the source).
  if (value instanceof Date) return new Date(value.getTime());
  if (value instanceof Map) {
    seen.add(ref);
    const obj: Record<string, unknown> = {};
    // A Proxy-backed/hostile Map can throw during iteration or per-entry read;
    // degrade the whole map to the getter marker rather than crashing the walk.
    try {
      for (const [k, v] of value) safeAssign(obj, String(k), v);
    } catch {
      seen.delete(ref);
      return GETTER_ERROR;
    }
    const result = walk(obj, depth, opts, seen);
    seen.delete(ref);
    return result;
  }
  if (value instanceof Set) {
    seen.add(ref);
    let items: unknown[];
    // Array.from drives the Set's iterator, which a Proxy-backed/hostile Set can
    // make throw; degrade to the marker instead of crashing the walk.
    try {
      items = Array.from(value);
    } catch {
      seen.delete(ref);
      return GETTER_ERROR;
    }
    const result = walk(items, depth, opts, seen);
    seen.delete(ref);
    return result;
  }

  if (Array.isArray(value)) {
    if (depth >= opts.maxDepth) return TRUNCATED_ARRAY;
    seen.add(ref);
    // Read the (capped) length here, then index element-by-element below. We
    // deliberately avoid `value.slice(...)` because slice eagerly reads every
    // element up front — a Proxy-backed/hostile element read would throw inside
    // slice, before the per-element guard, crashing the walk.
    const cap = Math.min(value.length, opts.maxArrayLength);
    const out: unknown[] = [];
    for (let i = 0; i < cap; i++) {
      let item: unknown;
      // An array element read can throw on a Proxy-backed/hostile array;
      // degrade that element to the getter marker rather than crashing.
      try {
        item = value[i];
      } catch {
        out.push(GETTER_ERROR);
        continue;
      }
      const walked = walk(item, depth + 1, opts, seen);
      // In arrays, an omitted item collapses to null to preserve index intent.
      out.push(walked === OMIT ? null : walked);
    }
    if (value.length > opts.maxArrayLength) {
      out.push(`[+${value.length - opts.maxArrayLength} more]`);
    }
    seen.delete(ref);
    return out;
  }

  // Plain objects and unknown object kinds (class instances) both rebuild as a
  // plain object from their own enumerable string keys.
  if (depth >= opts.maxDepth) return TRUNCATED_OBJECT;
  seen.add(ref);
  const out: Record<string, unknown> = {};
  walkObjectInto(out, value as Record<string, unknown>, depth, opts, seen);
  seen.delete(ref);
  return out;
}

/**
 * Warn (dev only, once per compress call) when redaction is fully disabled —
 * built-in deny-list off and no user matchers — so a sensitive value could pass
 * through unredacted. The `NODE_ENV` guard makes this a runtime no-op in
 * production; it never fires while any redaction is active.
 */
function warnIfRedactionDisabled(opts: ResolvedOptions): void {
  if (opts.defaultSanitize || opts.sanitize.length > 0) return;
  // Reference `process` via globalThis so the library stays zero-dependency and
  // needs no Node type definitions; in production the guard is a runtime no-op.
  const proc = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process;
  if (typeof proc !== "undefined" && proc.env?.NODE_ENV !== "production") {
    console.warn(
      "react-context-compressor: redaction is fully disabled " +
        "(defaultSanitize:false and no sanitize matchers); sensitive fields " +
        "will NOT be redacted.",
    );
  }
}

/**
 * Mechanically compress a state value into a minimal payload, applying the
 * structural transforms in {@link CompressOptions}. Pure and deterministic;
 * the input is never mutated.
 */
export function compressCore(state: unknown, options: CompressOptions = {}): unknown {
  const opts = resolveOptions(options);
  warnIfRedactionDisabled(opts);
  const walked = walk(state, 0, opts, new WeakSet());
  // A top-level function/symbol compresses to undefined rather than a sentinel.
  return walked === OMIT ? undefined : walked;
}
