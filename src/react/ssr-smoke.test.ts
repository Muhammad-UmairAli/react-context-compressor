import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { useCompressedContext } from "./index";

// Version-agnostic smoke test: exercises the hook under react-dom/server so it
// runs identically on React 17 / 18 / 19 (no React Testing Library, no jsdom —
// RTL's renderHook requires React 18+). The CI `react-compat` matrix installs
// each React major and runs this file; it also runs under React 19 in the main
// suite. Node environment (no `// @vitest-environment jsdom` directive).

function Probe({ state }: { state: unknown }) {
  const out = useCompressedContext(state, { maxDepth: 1 });
  return createElement("output", null, JSON.stringify(out));
}

describe("useCompressedContext — SSR smoke (React-version-agnostic)", () => {
  it("compresses + sanitizes when rendered with react-dom/server", () => {
    const markup = renderToStaticMarkup(
      createElement(Probe, {
        state: { a: 1, password: "SEKRET-VAL", deep: { b: { c: 1 } } },
      }),
    );
    expect(markup).toContain("[REDACTED]"); // sensitive key redacted
    expect(markup).not.toContain("SEKRET-VAL"); // secret value never emitted
    expect(markup).toContain("[Object]"); // depth cap at maxDepth: 1
  });
});
