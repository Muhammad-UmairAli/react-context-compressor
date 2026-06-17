import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Default to node; React hook tests (task 004) opt into jsdom via a
    // per-file `// @vitest-environment jsdom` directive.
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "src/**/*.tsx"],
      // src/react is the React bindings stub; its tests + coverage land in task 004.
      exclude: ["src/**/*.test.*", "src/**/*.d.ts", "src/react/**"],
      reporter: ["text", "html"],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
});
