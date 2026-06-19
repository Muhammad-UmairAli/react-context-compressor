import { afterEach, describe, expect, it, vi } from "vitest";
import type { CompressOptions } from "../index";
import { compress } from "../index";
import {
  CIRCULAR,
  DEFAULT_MAX_DEPTH,
  GETTER_ERROR,
  keyMatches,
  resolveOptions,
  TRUNCATED_ARRAY,
  TRUNCATED_OBJECT,
} from "./compress";

describe("compress — passthrough & primitives", () => {
  it("returns a deep copy with no options (does not mutate input)", () => {
    const input = { a: 1, nested: { b: 2 }, list: [1, 2] };
    const out = compress(input) as typeof input;
    expect(out).toEqual(input);
    expect(out).not.toBe(input);
    expect(out.nested).not.toBe(input.nested);
    out.nested.b = 99;
    expect(input.nested.b).toBe(2);
  });

  it("passes primitives through unchanged", () => {
    expect(compress(5)).toBe(5);
    expect(compress("x")).toBe("x");
    expect(compress(true)).toBe(true);
    expect(compress(null)).toBeNull();
    expect(compress(undefined)).toBeUndefined();
  });

  it("compresses a top-level function/symbol to undefined", () => {
    expect(compress(() => 1)).toBeUndefined();
    expect(compress(Symbol("s"))).toBeUndefined();
  });
});

describe("compress — maxDepth", () => {
  it("truncates objects deeper than maxDepth", () => {
    expect(compress({ a: { b: { c: 1 } } }, { maxDepth: 1 })).toEqual({ a: TRUNCATED_OBJECT });
    expect(compress({ a: { b: { c: 1 } } }, { maxDepth: 2 })).toEqual({
      a: { b: TRUNCATED_OBJECT },
    });
  });

  it("truncates arrays deeper than maxDepth", () => {
    expect(compress({ list: [[1]] }, { maxDepth: 1 })).toEqual({ list: TRUNCATED_ARRAY });
  });
});

describe("compress — strip", () => {
  it("strips keys by exact string and by RegExp at any depth", () => {
    const input = {
      keep: 1,
      drop: 2,
      secretToken: 3,
      nested: { drop: 4, alsoKeep: 5 },
    };
    expect(compress(input, { strip: ["drop", /^secret/] })).toEqual({
      keep: 1,
      nested: { alsoKeep: 5 },
    });
  });
});

describe("compress — maxArrayLength", () => {
  it("caps arrays and appends an elision marker", () => {
    expect(compress({ arr: [1, 2, 3, 4, 5] }, { maxArrayLength: 2 })).toEqual({
      arr: [1, 2, "[+3 more]"],
    });
  });

  it("leaves arrays within the cap untouched", () => {
    expect(compress({ arr: [1, 2] }, { maxArrayLength: 5 })).toEqual({ arr: [1, 2] });
  });
});

describe("compress — dropEmpty", () => {
  it("drops empty values but keeps falsy non-empty values", () => {
    const input = { a: 1, b: null, c: "", d: [], e: {}, f: 0, g: false };
    expect(compress(input, { dropEmpty: true })).toEqual({ a: 1, f: 0, g: false });
  });

  it("keeps empty values when dropEmpty is false (default)", () => {
    expect(compress({ a: null, b: "" })).toEqual({ a: null, b: "" });
  });
});

describe("compress — circular references", () => {
  it("replaces circular object back-references with a marker", () => {
    const obj: Record<string, unknown> = { name: "root" };
    obj.self = obj;
    expect(compress(obj)).toEqual({ name: "root", self: CIRCULAR });
  });

  it("replaces circular array back-references with a marker", () => {
    const arr: unknown[] = [1];
    arr.push(arr);
    expect(compress(arr)).toEqual([1, CIRCULAR]);
  });

  it("does not flag the same object used twice in sibling positions", () => {
    const shared = { id: 1 };
    expect(compress({ a: shared, b: shared })).toEqual({ a: { id: 1 }, b: { id: 1 } });
  });
});

describe("compress — non-plain values", () => {
  it("keeps Date instances (by value) but deep-copies them", () => {
    const d = new Date(0);
    const out = compress({ d }) as { d: Date };
    expect(out).toEqual({ d });
    // Distinct instance — the output never shares a live reference with input.
    expect(out.d).not.toBe(d);
    // Mutating the returned Date must not reach back into the input.
    out.d.setFullYear(1999);
    expect(d.getTime()).toBe(0);
  });

  it("converts Map to a plain object", () => {
    const m = new Map<string, unknown>([
      ["k", "v"],
      ["n", 2],
    ]);
    expect(compress({ m })).toEqual({ m: { k: "v", n: 2 } });
  });

  it("converts Set to an array", () => {
    expect(compress({ s: new Set([1, 2, 3]) })).toEqual({ s: [1, 2, 3] });
  });

  it("drops functions and symbols inside objects", () => {
    expect(compress({ a: 1, fn: () => 1, sym: Symbol("x") })).toEqual({ a: 1 });
  });

  it("collapses an omitted array item to null to preserve index", () => {
    expect(compress([1, () => 1, 3])).toEqual([1, null, 3]);
  });

  it("enumerates own enumerable props of class instances", () => {
    class Foo {
      x = 1;
      fn = () => 2;
    }
    expect(compress(new Foo())).toEqual({ x: 1 });
  });
});

describe("compress — determinism", () => {
  it("produces identical output for identical input + options", () => {
    const input = { a: [1, { b: 2 }], c: "x" };
    const opts = { maxDepth: 5, dropEmpty: true };
    expect(compress(input, opts)).toEqual(compress(input, opts));
  });
});

describe("helpers", () => {
  it("keyMatches handles strings and RegExp", () => {
    expect(keyMatches("token", ["token"])).toBe(true);
    expect(keyMatches("Token", ["token"])).toBe(false);
    expect(keyMatches("apiKey", [/key/i])).toBe(true);
    expect(keyMatches("name", ["token", /secret/])).toBe(false);
  });

  it("resolveOptions fills defaults", () => {
    const r = resolveOptions({});
    expect(r.maxDepth).toBe(DEFAULT_MAX_DEPTH);
    expect(r.maxArrayLength).toBe(Number.POSITIVE_INFINITY);
    expect(r.strip).toEqual([]);
    expect(r.dropEmpty).toBe(false);
  });
});

describe("compress — security & robustness (review fixes)", () => {
  it("does not allow prototype pollution via a __proto__ key (B1)", () => {
    const input = JSON.parse('{"__proto__":{"isAdmin":true},"a":1}');
    const out = compress(input) as Record<string, unknown>;
    // No phantom inherited property; prototype untouched.
    expect((out as { isAdmin?: unknown }).isAdmin).toBeUndefined();
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    // The __proto__ payload is preserved as a real own property (not silently lost).
    expect(Object.hasOwn(out, "__proto__")).toBe(true);
    expect(out.a).toBe(1);
    // The global prototype is never mutated.
    expect(({} as { isAdmin?: unknown }).isAdmin).toBeUndefined();
  });

  it("handles a self-referential Map without overflowing the stack (B2)", () => {
    const m = new Map<string, unknown>();
    m.set("self", m);
    m.set("k", "v");
    expect(compress(m)).toEqual({ self: CIRCULAR, k: "v" });
  });

  it("handles a self-referential Set without overflowing the stack (B2)", () => {
    const s = new Set<unknown>();
    s.add(1);
    s.add(s);
    expect(compress(s)).toEqual([1, CIRCULAR]);
  });

  it("degrades a throwing getter to a marker instead of crashing (B3)", () => {
    const obj: Record<string, unknown> = {};
    Object.defineProperty(obj, "boom", {
      enumerable: true,
      get() {
        throw new Error("kaboom");
      },
    });
    obj.safe = 1;
    expect(compress(obj)).toEqual({ boom: GETTER_ERROR, safe: 1 });
  });

  it("coerces BigInt to a JSON-serializable string (A1)", () => {
    const out = compress({ big: 42n });
    expect(out).toEqual({ big: "42" });
    expect(() => JSON.stringify(out)).not.toThrow();
  });

  it("caps pathologically deep input at the default maxDepth instead of overflowing (Finding 4)", () => {
    let deep: Record<string, unknown> = { leaf: true };
    for (let i = 0; i < 50_000; i++) deep = { n: deep };
    expect(() => compress(deep)).not.toThrow();
    // With Infinity the same input would overflow the stack — opt-in only.
    expect(() => compress(deep, { maxDepth: 5 })).not.toThrow();
  });
});

describe("compress — proxy-safe iteration (003)", () => {
  it("degrades a Map whose iteration throws to a marker instead of crashing", () => {
    // A Map subclass whose iterator throws (mimics a Proxy-backed/hostile Map).
    class HostileMap extends Map {
      [Symbol.iterator](): IterableIterator<[unknown, unknown]> {
        throw new Error("hostile map iteration");
      }
    }
    const m = new HostileMap();
    expect(() => compress({ m })).not.toThrow();
    expect(compress({ m })).toEqual({ m: GETTER_ERROR });
  });

  it("degrades a Set whose iteration throws to a marker instead of crashing", () => {
    class HostileSet extends Set {
      [Symbol.iterator](): IterableIterator<unknown> {
        throw new Error("hostile set iteration");
      }
    }
    const s = new HostileSet();
    expect(() => compress({ s })).not.toThrow();
    expect(compress({ s })).toEqual({ s: GETTER_ERROR });
  });

  it("degrades a throwing array element read to a marker instead of crashing", () => {
    // An array with a throwing index getter (mimics a Proxy-backed/hostile array).
    const arr: unknown[] = [1, 2, 3];
    Object.defineProperty(arr, "1", {
      enumerable: true,
      configurable: true,
      get() {
        throw new Error("hostile element read");
      },
    });
    expect(() => compress({ arr })).not.toThrow();
    expect(compress({ arr })).toEqual({ arr: [1, GETTER_ERROR, 3] });
  });

  it("degrades a throwing array element even when maxArrayLength caps the array", () => {
    // Capped arrays must not read elements via slice (which would throw up front
    // before the per-element guard); the indexed read degrades gracefully.
    const arr: unknown[] = [1, 2, 3, 4, 5];
    Object.defineProperty(arr, "1", {
      enumerable: true,
      configurable: true,
      get() {
        throw new Error("hostile element read");
      },
    });
    expect(() => compress({ arr }, { maxArrayLength: 3 })).not.toThrow();
    expect(compress({ arr }, { maxArrayLength: 3 })).toEqual({
      arr: [1, GETTER_ERROR, 3, "[+2 more]"],
    });
  });

  it("does not falsely flag a hostile Map reused in sibling positions as circular", () => {
    // The Map catch path must still run seen.delete(ref) so a second sibling use
    // degrades to the marker again, not to [Circular].
    class HostileMap extends Map {
      [Symbol.iterator](): IterableIterator<[unknown, unknown]> {
        throw new Error("hostile map iteration");
      }
    }
    const m = new HostileMap();
    expect(compress({ a: m, b: m })).toEqual({ a: GETTER_ERROR, b: GETTER_ERROR });
  });

  it("does not falsely flag a hostile Set reused in sibling positions as circular", () => {
    class HostileSet extends Set {
      [Symbol.iterator](): IterableIterator<unknown> {
        throw new Error("hostile set iteration");
      }
    }
    const s = new HostileSet();
    expect(compress({ a: s, b: s })).toEqual({ a: GETTER_ERROR, b: GETTER_ERROR });
  });

  it("coerces a non-string redactedValue to a string (JS caller bypass)", () => {
    // A JS caller can pass a number despite the TS type; it must not leak as raw.
    const out = compress({ password: "x" }, {
      redactedValue: 0,
    } as unknown as CompressOptions) as Record<string, unknown>;
    expect(out.password).toBe("0");
    expect(typeof out.password).toBe("string");
  });

  it("coerces a falsy non-string redactedValue rather than falling back to default", () => {
    // `false` is non-nullish, so it must be String()-coerced, not replaced by the default.
    const out = compress({ password: "x" }, {
      redactedValue: false,
    } as unknown as CompressOptions) as Record<string, unknown>;
    expect(out.password).toBe("false");
  });

  it("falls back to the default when redactedValue coercion throws (hostile toString)", () => {
    const hostile = {
      toString() {
        throw new Error("hostile toString");
      },
    };
    expect(() =>
      compress({ password: "x" }, { redactedValue: hostile } as unknown as CompressOptions),
    ).not.toThrow();
    const out = compress({ password: "x" }, {
      redactedValue: hostile,
    } as unknown as CompressOptions) as Record<string, unknown>;
    expect(out.password).toBe("[REDACTED]");
  });
});

describe("compress — dev-warning when redaction disabled (003)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("warns once when redaction is fully disabled (defaultSanitize:false, no matchers)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    compress({ password: "x" }, { defaultSanitize: false });
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("does NOT warn when redaction is active (defaults on)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    compress({ password: "x" });
    expect(warn).not.toHaveBeenCalled();
  });

  it("does NOT warn when built-ins are off but user matchers are supplied", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    compress({ password: "x" }, { defaultSanitize: false, sanitize: ["password"] });
    expect(warn).not.toHaveBeenCalled();
  });
});
