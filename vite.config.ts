import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { enhancedImages } from "@sveltejs/enhanced-img";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    enhancedImages(), // must come before the SvelteKit plugin
    tailwindcss(),
    sveltekit(),
  ],
  ssr: {
    // Keep CJS packages external so Node loads them natively instead of
    // bundling require() calls into the ESM server build.
    external: [
      "cheerio",
      "drizzle-orm",
      "bullmq",
      "import-in-the-middle",
      "require-in-the-middle",
    ],
  },
  server: {
    allowedHosts: [
      "app", // In Docker Compose, this is the `app` service and runs
      // on the host `app`.
      ...(process.env.SJS_HOSTNAME ? [process.env.SJS_HOSTNAME] : []),
    ],
    hmr: process.env.SJS_HOSTNAME
      ? { host: process.env.SJS_HOSTNAME, protocol: "wss", clientPort: 443 }
      : undefined,
    fs: {
      allow: ["uploads"],
    },
  },
});
