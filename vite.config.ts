import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { sentrySvelteKit } from "@sentry/sveltekit";
import { enhancedImages } from "@sveltejs/enhanced-img";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    enhancedImages(), // must come before the SvelteKit plugin
    tailwindcss(),
    sentrySvelteKit({ autoInstrument: false }),
    sveltekit(),
  ],
  ssr: {
    // Keep CJS packages external so Node loads them natively instead of
    // bundling require() calls into the ESM server build.
    external: ["cheerio", "drizzle-orm", "bullmq"],
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
