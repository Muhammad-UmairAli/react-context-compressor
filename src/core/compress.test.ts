import { describe, expect, it } from "vitest";
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
  it("keeps Date instances", () => {
    const d = new Date(0);
    expect(compress({ d })).toEqual({ d });
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
