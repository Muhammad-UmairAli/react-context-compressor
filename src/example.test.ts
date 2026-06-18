import { describe, expect, it } from "vitest";
import { compress } from "./index";

/**
 * A representative slice of application state — UI flags, deep view-models, a
 * long list, and secrets — the kind of blob an app might otherwise
 * `JSON.stringify` straight to an LLM. Mirrored by `examples/demo.mjs`.
 */
function makeState() {
  return {
    auth: {
      userId: "u_123",
      token: "secret-jwt-aaaaa.bbbbb.ccccc",
      refreshToken: "rt-zzzzzzzzzzzzzzzz",
    },
    ui: { isLoading: false, hoveredId: null, modalOpen: false, scrollY: 0, _internalRef: {} },
    user: {
      name: "Ada Lovelace",
      email: "ada@example.com",
      apiKey: "sk-live-000000000000000000",
      preferences: { theme: "dark", density: "compact", _cache: { a: { b: { c: { d: 1 } } } } },
    },
    feed: Array.from({ length: 200 }, (_, i) => ({
      id: i,
      title: `Item ${i}`,
      seenAt: null,
      _meta: { renderedBy: "list", dirty: false },
    })),
  };
}

describe("example: token-saving compression", () => {
  it("reduces serialized size by >= 50% on representative state", () => {
    const state = makeState();
    const before = JSON.stringify(state).length;
    const compressed = compress(state, {
      maxDepth: 3,
      maxArrayLength: 5,
      dropEmpty: true,
      strip: [/^_/, "hoveredId", "scrollY"],
    });
    const after = JSON.stringify(compressed).length;
    const reduction = 1 - after / before;
    expect(reduction).toBeGreaterThanOrEqual(0.5);
  });

  it("strips secrets from the representative state (no leak)", () => {
    const json = JSON.stringify(compress(makeState()));
    for (const secret of [
      "secret-jwt-aaaaa",
      "rt-zzzzzzzzzzzzzzzz",
      "sk-live-000000000000000000",
    ]) {
      expect(json).not.toContain(secret);
    }
  });
});
