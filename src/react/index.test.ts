// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useCompressedContext } from "./index";
import { optionsSignature } from "./signature";

describe("useCompressedContext", () => {
  it("returns the compressed + sanitized payload", () => {
    const { result } = renderHook(() =>
      useCompressedContext({ a: 1, password: "x", deep: { b: { c: 1 } } }, { maxDepth: 1 }),
    );
    expect(result.current).toEqual({ a: 1, password: "[REDACTED]", deep: "[Object]" });
  });

  it("memoizes: stable result across re-renders with the same state ref", () => {
    const state = { a: 1 };
    const { result, rerender } = renderHook((props) => useCompressedContext(props), {
      initialProps: state,
    });
    const first = result.current;
    rerender(state);
    expect(result.current).toBe(first);
  });

  it("recomputes when the state reference changes", () => {
    const { result, rerender } = renderHook((props) => useCompressedContext(props), {
      initialProps: { a: 1 },
    });
    const first = result.current;
    rerender({ a: 2 });
    expect(result.current).not.toBe(first);
    expect(result.current).toEqual({ a: 2 });
  });

  it("does not thrash memoization on inline (new-ref) options of equal content", () => {
    const state = { a: 1 };
    const { result, rerender } = renderHook(({ s }) => useCompressedContext(s, { maxDepth: 5 }), {
      initialProps: { s: state },
    });
    const first = result.current;
    rerender({ s: state });
    expect(result.current).toBe(first);
  });

  it("recomputes when options content changes", () => {
    const state = { deep: { x: { y: 1 } } };
    const { result, rerender } = renderHook(
      ({ d }) => useCompressedContext(state, { maxDepth: d }),
      {
        initialProps: { d: 1 },
      },
    );
    const first = result.current;
    rerender({ d: 3 });
    expect(result.current).not.toBe(first);
  });

  it("redacts sensitive fields through the hook (no leak)", () => {
    const { result } = renderHook(() => useCompressedContext({ name: "n", apiKey: "LEAK" }));
    expect(JSON.stringify(result.current)).not.toContain("LEAK");
  });

  it("recomputes when a matcher changes (same state ref)", () => {
    const state = { a: 1, b: 2 };
    const { result, rerender } = renderHook(({ strip }) => useCompressedContext(state, { strip }), {
      initialProps: { strip: ["a"] as string[] },
    });
    const first = result.current;
    rerender({ strip: ["b"] });
    expect(result.current).not.toBe(first);
    expect(result.current).toEqual({ a: 1 });
  });
});

describe("optionsSignature", () => {
  it("is equal for equal content and differs for different content", () => {
    expect(optionsSignature({ maxDepth: 3 })).toBe(optionsSignature({ maxDepth: 3 }));
    expect(optionsSignature({ maxDepth: 3 })).not.toBe(optionsSignature({ maxDepth: 4 }));
  });

  it("distinguishes Infinity from unset maxDepth", () => {
    expect(optionsSignature({ maxDepth: Number.POSITIVE_INFINITY })).not.toBe(optionsSignature({}));
  });

  it("encodes string and RegExp matchers (flags matter)", () => {
    expect(optionsSignature({ strip: ["a", /b/i] })).toBe(optionsSignature({ strip: ["a", /b/i] }));
    expect(optionsSignature({ sanitize: [/x/] })).not.toBe(optionsSignature({ sanitize: [/x/i] }));
  });

  it("is collision-free for matcher contents containing delimiter-like text (B1)", () => {
    expect(optionsSignature({ strip: ["a", "b"] })).not.toBe(
      optionsSignature({ strip: ["a|s:b"] }),
    );
    expect(optionsSignature({ strip: ["a", "b"] })).not.toBe(optionsSignature({ strip: ["ab"] }));
  });

  it("distinguishes Infinity from unset maxArrayLength", () => {
    expect(optionsSignature({ maxArrayLength: Number.POSITIVE_INFINITY })).not.toBe(
      optionsSignature({}),
    );
  });
});
