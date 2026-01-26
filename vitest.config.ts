import { defineConfig } from "vitest/config";
import { sveltekit } from "@sveltejs/kit/vite";
import { execSync } from "child_process";

// Pre-generate Prisma client before tests
try {
  execSync("npx prisma generate", { stdio: "inherit" });
} catch (error) {
  console.error("Failed to generate Prisma client:", error);
}

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    environment: "node",
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
