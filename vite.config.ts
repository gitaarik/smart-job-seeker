import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { sentrySvelteKit } from '@sentry/sveltekit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		// No build-time instrumentation: Sentry 11 would move pg, ioredis and the
		// @langchain packages into ssr.noExternal to instrument them, bundling a
		// second copy beside the external packages that import them. Nothing here
		// records spans (tracesSampleRate 0), so it would buy nothing.
		sentrySvelteKit({ autoInstrument: false, buildTimeInstrumentation: false }),
		sveltekit()
	],
	ssr: {
		// Keep CJS packages external so Node loads them natively instead of
		// bundling require() calls into the ESM server build.
		//
		// pdf-parse v2 ships an ESM `exports` map that vite's SSR resolver fails
		// to resolve ("Failed to resolve entry for package pdf-parse"); leaving it
		// external lets Node resolve the exports map natively (used lazily in
		// src/lib/server/resume/text-extractor.ts for CV upload).
		external: ['cheerio', 'drizzle-orm', 'bullmq', 'pdf-parse'],
		// @xyflow/svelte ships uncompiled .svelte files in dist. Vite's svelte
		// plugin normally spots those via the package's `svelte` export condition
		// and pulls it in automatically, but Sentry 10's import-in-the-middle hook
		// got the load first and handed it to Node, which has no idea what a
		// .svelte file is — the route 500ed on SSR with ERR_UNKNOWN_FILE_EXTENSION.
		// Sentry 11's load hooks are off (monitoring/sentry.ts); naming it here
		// still keeps the transform with Vite, where it belongs.
		noExternal: ['@xyflow/svelte']
	},
	server: {
		allowedHosts: [
			'app', // In Docker Compose, this is the `app` service and runs
			// on the host `app`.
			...(process.env.SJS_HOSTNAME ? [process.env.SJS_HOSTNAME] : [])
		],
		hmr: process.env.SJS_HOSTNAME
			? { host: process.env.SJS_HOSTNAME, protocol: 'wss', clientPort: 443 }
			: undefined
		// No `fs.allow` for `uploads/`.
		//
		// It was here so the dev server could hand back `/uploads/...` straight
		// from disk, which worked and quietly made dev the only environment where
		// the `/uploads/[...path]` route never runs: Vite's static middleware
		// answered first. That route is what refuses `uploads/files/`, the private
		// blob store behind the `files` table — so on dev, and only on dev, every
		// CV, export and project image was readable by anyone who knew its
		// filename, and no test on dev could have shown it.
		//
		// The route reads the files itself with `node:fs`, which `fs.allow` has no
		// say over, so serving still works here. It just goes the same way it goes
		// everywhere else.
	}
});
