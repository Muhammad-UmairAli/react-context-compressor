import { describe, expect, it } from "vitest";
import { compress } from "./index";

describe("compress (task 001 stub)", () => {
  it("returns the provided state (stub passthrough)", () => {
    const state = { a: 1, nested: { b: 2 } };
    expect(compress(state)).toEqual(state);
  });

  it("accepts options without throwing", () => {
    expect(() => compress({ x: 1 }, { maxDepth: 2, dropEmpty: true })).not.toThrow();
  });
});
