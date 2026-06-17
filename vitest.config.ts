import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Default to node; React hook tests (task 004) opt into jsdom via a
    // per-file `// @vitest-environment jsdom` directive.
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["src/**/*.test.*", "src/**/*.d.ts"],
      reporter: ["text", "html"],
      // The >=90% gate on the core lands with real logic in tasks 002/003.
    },
  },
});
