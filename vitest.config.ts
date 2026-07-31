import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  test: {
    environment: "node",
    // Scope to the Next.js app tests. Rapi is a separate package with its
    // own vitest.config.ts and test script (run via `cd Rapi && npm test`).
    include: ["lib/**/*.test.ts"],
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
