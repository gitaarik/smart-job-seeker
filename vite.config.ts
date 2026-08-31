import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { sentrySvelteKit } from '@sentry/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sentrySvelteKit({ autoInstrument: false }), sveltekit()],
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
		// and pulls it in automatically, but Sentry's import-in-the-middle hook
		// gets the load first and hands it to Node, which has no idea what a
		// .svelte file is — the route 500s on SSR with ERR_UNKNOWN_FILE_EXTENSION.
		// Naming it here keeps the transform with Vite, where it belongs.
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
