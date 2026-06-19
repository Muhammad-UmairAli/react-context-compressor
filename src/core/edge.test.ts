import { describe, expect, it } from "vitest";
import { compress } from "../index";
import { CIRCULAR, GETTER_ERROR, TRUNCATED_OBJECT } from "./compress";
import { REDACTED } from "./sanitize";

describe("compress — edge cases (task 004 backfill)", () => {
  it("walks null-prototype objects as plain objects", () => {
    const inner = Object.assign(Object.create(null), { b: 2 });
    const o = Object.assign(Object.create(null), { a: 1, nested: inner });
    expect(compress(o)).toEqual({ a: 1, nested: { b: 2 } });
  });

  it("represents a RegExp as its source string", () => {
    expect(compress({ re: /ab+c/gi })).toEqual({ re: "/ab+c/gi" });
  });

  it("represents an Error as { name, message }", () => {
    expect(compress({ e: new Error("boom") })).toEqual({
      e: { name: "Error", message: "boom" },
    });
    class CustomError extends Error {
      override name = "CustomError";
    }
    expect(compress({ e: new CustomError("nope") })).toEqual({
      e: { name: "CustomError", message: "nope" },
    });
  });

  it("converts a TypedArray to a plain number array (and respects maxArrayLength)", () => {
    expect(compress({ t: new Uint8Array([1, 2, 3]) })).toEqual({ t: [1, 2, 3] });
    expect(compress({ t: new Uint8Array([1, 2, 3, 4]) }, { maxArrayLength: 2 })).toEqual({
      t: [1, 2, "[+2 more]"],
    });
  });

  it("elides all elements to a single marker when maxArrayLength is 0", () => {
    expect(compress({ arr: [1, 2, 3] }, { maxArrayLength: 0 })).toEqual({ arr: ["[+3 more]"] });
  });

  it("keeps truncation/circular markers under dropEmpty (markers are non-empty)", () => {
    expect(
      compress({ deep: { x: { y: 1 } }, gone: null }, { maxDepth: 1, dropEmpty: true }),
    ).toEqual({ deep: TRUNCATED_OBJECT });

    const cyc: Record<string, unknown> = {};
    cyc.self = cyc;
    expect(compress(cyc, { dropEmpty: true })).toEqual({ self: CIRCULAR });
  });

  it("degrades a hostile Error subclass (throwing getter) to a marker, never throws", () => {
    class WeirdError extends Error {
      override get message(): string {
        throw new Error("hostile");
      }
    }
    expect(() => compress({ e: new WeirdError() })).not.toThrow();
    expect(compress({ e: new WeirdError() })).toEqual({ e: GETTER_ERROR });
  });

  it("flattens a DataView to {} (excluded from the TypedArray path)", () => {
    expect(compress({ d: new DataView(new ArrayBuffer(8)) })).toEqual({ d: {} });
  });

  it("still redacts a RegExp/Error stored under a sensitive key (sanitize-before-read)", () => {
    expect(compress({ token: new Error("leak"), apiKey: /secret/ })).toEqual({
      token: REDACTED,
      apiKey: REDACTED,
    });
  });
});
