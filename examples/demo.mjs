// Runnable demo — shows real token-saving compression + sanitization.
//
//   npm run build        # emit dist/
//   node examples/demo.mjs
//
// Mirrors the fixture in src/example.test.ts.
import { compress } from "../dist/index.mjs";

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

const state = makeState();
const before = JSON.stringify(state);
const compressed = compress(state, {
  maxDepth: 3,
  maxArrayLength: 5,
  dropEmpty: true,
  strip: [/^_/, "hoveredId", "scrollY"],
});
const after = JSON.stringify(compressed);
const pct = ((1 - after.length / before.length) * 100).toFixed(1);

console.log(`Before: ${before.length} chars`);
console.log(`After:  ${after.length} chars`);
console.log(`Reduction: ${pct}%`);
console.log(
  "Secrets leaked?",
  ["secret-jwt", "rt-zzzz", "sk-live"].some((s) => after.includes(s)),
);
console.log("\nCompressed payload:\n", JSON.stringify(compressed, null, 2));
