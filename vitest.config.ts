import { defineConfig } from "vitest/config";
import { sveltekit } from "@sveltejs/kit/vite";

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    environment: "node",
    exclude: ["e2e/**", "node_modules/**"],
    setupFiles: ["./vitest.setup.ts"],
    pool: "forks", // Prevents node processes from staying alive after tests
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/**",
        "generated/**",
        ".svelte-kit/**",
        "**/*.config.ts",
        "**/*.config.js",
        "**/test-utils/**",
        "**/__tests__/**",
        "**/vitest.setup.ts",
      ],
    },
  },
});
