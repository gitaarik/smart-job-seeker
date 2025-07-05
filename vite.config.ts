import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { enhancedImages } from "@sveltejs/enhanced-img";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    enhancedImages(), // must come before the SvelteKit plugin
    tailwindcss(),
    sveltekit()
  ],
  server: {
    allowedHosts: [
      'app' // This allows Directus CMS to do HTTP requests from it's
            // Docker container to this one. In Docker compose, this is the
            // `app` service and runs on the host `app`.
    ]
  },
  test: {
    globals: true,
    environment: "node",
    setupFiles: [],
    env: {
      PRISMA_DISABLE_WARNINGS: "true",
    },
  },
});
