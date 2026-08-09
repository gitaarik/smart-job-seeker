/**
 * Bundle the CLI scripts so they can run in the production image.
 *
 * The production app image ships `scripts/` but not `src/` — the runtime stage
 * copies only the compiled SvelteKit `build/`. So every script importing
 * `$lib/...` was unrunnable there: `Cannot find package '$lib'`. That is 24 of
 * them, including the backfills that docs/DEPLOYMENT.md § Post-Deploy Manual
 * Steps tells you to run after a deploy. They had never run in production
 * because they could not.
 *
 * This resolves `$lib` at BUILD time, when `src/` is still present, and emits
 * self-contained ESM into `dist-scripts/`. The Dockerfile copies that into the
 * runtime stage, so the documented invocation becomes real:
 *
 *   docker compose exec app node dist-scripts/backfill-job-regions.mjs --apply
 *
 * `packages: "external"` leaves every bare import (pg, drizzle-orm, langchain,
 * …) alone — node_modules IS present at runtime, and bundling dependencies
 * would drag in native and optional ones for no benefit. Only our own source
 * gets inlined.
 *
 * Entry points are discovered, not listed: a new script that reaches into app
 * source is picked up automatically rather than silently shipping broken. See
 * REACHES_APP_SOURCE below for what "reaches into" means and which script
 * proved that a narrower rule was not enough.
 */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const scriptsDir = path.join(root, 'scripts');
const outDir = path.join(root, 'dist-scripts');

/**
 * A script needs bundling if it reaches into app source at all — through the
 * `$lib` alias OR by climbing out of `scripts/` with a relative path. Matching
 * only `$lib` is what this used to do, and it silently shipped
 * `migrate-encrypt-api-keys.ts` broken: it imports `../src/lib/...` directly, so
 * discovery skipped it, no bundle was emitted, and the runtime image kept the
 * raw `.ts` — which looks runnable (the file is there, `tsx` is installed) right
 * up until `ERR_MODULE_NOT_FOUND: /app/src/lib/server/db/schema.js`. Verified on
 * preview 2026-08-09. It is a documented post-deploy step in
 * `docs/DEPLOYMENT.md`, so the one script the discovery missed was one the
 * runbook tells you to run.
 *
 * Deliberately a superset of the old pattern: every file it used to match still
 * matches, so widening can add bundles but never drop one.
 */
const REACHES_APP_SOURCE = /\$lib|['"]\.\.\/src\//;

const entryPoints = fs
	.readdirSync(scriptsDir)
	.filter((f) => f.endsWith('.ts'))
	.filter((f) => REACHES_APP_SOURCE.test(fs.readFileSync(path.join(scriptsDir, f), 'utf8')))
	.map((f) => path.join(scriptsDir, f))
	.sort();

if (entryPoints.length === 0) {
	console.error('No scripts import app source — that is almost certainly wrong.');
	process.exit(1);
}

fs.rmSync(outDir, { recursive: true, force: true });

await esbuild.build({
	entryPoints,
	outdir: outDir,
	outExtension: { '.js': '.mjs' },
	bundle: true,
	platform: 'node',
	format: 'esm',
	target: 'node22',
	packages: 'external',
	alias: { $lib: path.join(root, 'src/lib') },
	logLevel: 'warning'
});

console.log(`Bundled ${entryPoints.length} ops scripts -> dist-scripts/`);
