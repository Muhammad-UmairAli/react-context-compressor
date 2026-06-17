/**
 * Core compression walker — mechanical, deterministic, zero-dependency.
 *
 * A single recursive pass applies: key stripping, depth capping, array-length
 * capping, and empty-value dropping, with circular-reference protection.
 * Sanitization (task 003) composes into this same walk via {@link CompressOptions.sanitize}.
 */

import type { CompressOptions } from "../index";

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
}

const DEFAULTS: ResolvedOptions = {
  maxDepth: DEFAULT_MAX_DEPTH,
  maxArrayLength: Number.POSITIVE_INFINITY,
  strip: [],
  dropEmpty: false,
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
    } else if (matcher.test(key)) {
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
 * Resolve user options against defaults. Exposed so the React layer and
 * sanitization can share one normalization path.
 */
export function resolveOptions(options: CompressOptions): ResolvedOptions {
  return {
    maxDepth: options.maxDepth ?? DEFAULTS.maxDepth,
    maxArrayLength: options.maxArrayLength ?? DEFAULTS.maxArrayLength,
    strip: options.strip ?? DEFAULTS.strip,
    dropEmpty: options.dropEmpty ?? DEFAULTS.dropEmpty,
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
  if (value instanceof Date) return value;
  if (value instanceof Map) {
    seen.add(ref);
    const obj: Record<string, unknown> = {};
    for (const [k, v] of value) safeAssign(obj, String(k), v);
    const result = walk(obj, depth, opts, seen);
    seen.delete(ref);
    return result;
  }
  if (value instanceof Set) {
    seen.add(ref);
    const result = walk(Array.from(value), depth, opts, seen);
    seen.delete(ref);
    return result;
  }

  if (Array.isArray(value)) {
    if (depth >= opts.maxDepth) return TRUNCATED_ARRAY;
    seen.add(ref);
    const limited =
      value.length > opts.maxArrayLength ? value.slice(0, opts.maxArrayLength) : value;
    const out: unknown[] = [];
    for (const item of limited) {
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
 * Mechanically compress a state value into a minimal payload, applying the
 * structural transforms in {@link CompressOptions}. Pure and deterministic;
 * the input is never mutated.
 */
export function compressCore(state: unknown, options: CompressOptions = {}): unknown {
  const opts = resolveOptions(options);
  const walked = walk(state, 0, opts, new WeakSet());
  // A top-level function/symbol compresses to undefined rather than a sentinel.
  return walked === OMIT ? undefined : walked;
}
