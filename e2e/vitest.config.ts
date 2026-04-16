import { defineConfig } from "vitest/config";

/**
 * Smoke test config — runs against a live dev server.
 * Requires the Docker dev stack to be running (npm start from cloud/).
 *
 * Run: npm run test:e2e (from oss/)
 */
export default defineConfig({
  test: {
    include: ["e2e/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
