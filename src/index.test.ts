import { describe, expect, it } from "vitest";
import { type CompressOptions, compress } from "./index";

describe("public API: compress", () => {
  it("is exported and returns a deep copy by default", () => {
    const state = { a: 1, nested: { b: 2 } };
    expect(compress(state)).toEqual(state);
    expect(compress(state)).not.toBe(state);
  });

  it("applies structural options end-to-end", () => {
    const state = { keep: 1, drop: 2, deep: { x: { y: 1 } }, big: [1, 2, 3] };
    const options: CompressOptions = {
      strip: ["drop"],
      maxDepth: 2,
      maxArrayLength: 2,
    };
    expect(compress(state, options)).toEqual({
      keep: 1,
      deep: { x: "[Object]" },
      big: [1, 2, "[+1 more]"],
    });
  });
});
