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
    // One live server, one test user, one selected-profile cookie: test files
    // are not isolated from each other the way unit tests are. Running them in
    // parallel let the profile-creation flow switch the selected profile out
    // from under a suite navigating that profile's applications, which failed
    // seven tests that all pass when their file runs alone. Isolated browser
    // contexts do not help — the collision is on shared server-side state.
    fileParallelism: false,
  },
});
