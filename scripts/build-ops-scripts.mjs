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
 * Entry points are discovered, not listed: a new script that imports $lib is
 * picked up automatically rather than silently shipping broken.
 */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const scriptsDir = path.join(root, 'scripts');
const outDir = path.join(root, 'dist-scripts');

const entryPoints = fs
	.readdirSync(scriptsDir)
	.filter((f) => f.endsWith('.ts'))
	.filter((f) => /\$lib/.test(fs.readFileSync(path.join(scriptsDir, f), 'utf8')))
	.map((f) => path.join(scriptsDir, f))
	.sort();

if (entryPoints.length === 0) {
	console.error('No scripts import $lib — that is almost certainly wrong.');
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
