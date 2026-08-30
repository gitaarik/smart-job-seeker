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
 * A file reaches app source if it names it — through the `$lib` alias, or by
 * climbing out of its own directory into `src/`. Matching only `$lib` is what
 * this used to do, and it silently shipped `migrate-encrypt-api-keys.ts`
 * broken: it imports `../src/lib/...` directly, so discovery skipped it, no
 * bundle was emitted, and the runtime image kept the raw `.ts` — which looks
 * runnable (the file is there, `tsx` is installed) right up until
 * `ERR_MODULE_NOT_FOUND: /app/src/lib/server/db/schema.js`. Verified on preview
 * 2026-08-09. It is a documented post-deploy step in `docs/DEPLOYMENT.md`, so
 * the one script the discovery missed was one the runbook tells you to run.
 *
 * The climb is `(\.\.\/)+` rather than a single `../` because a helper does not
 * sit at the same depth as its caller: `scripts/lib/ontology-replay.ts` reaches
 * the database through `'../../src/lib/server/db'`, which a one-level pattern
 * reads as no reach at all.
 *
 * Deliberately a superset of the old pattern: every file it used to match still
 * matches, so widening can add bundles but never drop one.
 */
const REACHES_APP_SOURCE = /\$lib|['"](?:\.\.\/)+src\//;

/**
 * The files a source imports by relative path, resolved to disk.
 *
 * Only relative specifiers: a bare one is a package, which `packages:
 * "external"` leaves alone anyway. Unresolvable ones are dropped rather than
 * reported — this is a discovery pass, and esbuild is the thing entitled to
 * complain about an import that does not exist.
 */
function localImports(file) {
	const src = fs.readFileSync(file, 'utf8');
	const out = [];
	for (const m of src.matchAll(/from\s*['"](\.[^'"]*)['"]|import\s*\(\s*['"](\.[^'"]*)['"]/g)) {
		const base = path.resolve(path.dirname(file), m[1] ?? m[2]);
		for (const candidate of [base, `${base}.ts`, path.join(base, 'index.ts')]) {
			if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
				out.push(candidate);
				break;
			}
		}
	}
	return out;
}

/**
 * Whether a script reaches app source at all, following what it imports.
 *
 * Reading only the entry file is what this used to do, and it shipped
 * `fix-ontology-decisions.ts` broken for the same reason and in the same shape
 * as `migrate-encrypt-api-keys.ts` above: its own text names nothing under
 * `src/`, because it reaches the database through `scripts/lib/ontology-replay`.
 * No bundle, raw `.ts` in an image with no `src/`, and the failure waits until
 * somebody runs the one script that carries a cleanup to a deployed box. Found
 * on preview 2026-08-30, while trying to do exactly that.
 *
 * `seen` guards the cycle rather than the cost: two helpers importing each
 * other is legal and would otherwise recurse until the stack ran out.
 */
function reachesAppSource(file, seen = new Set()) {
	const resolved = path.resolve(file);
	if (seen.has(resolved)) return false;
	seen.add(resolved);
	if (REACHES_APP_SOURCE.test(fs.readFileSync(resolved, 'utf8'))) return true;
	return localImports(resolved).some((next) => reachesAppSource(next, seen));
}

const entryPoints = fs
	.readdirSync(scriptsDir)
	.filter((f) => f.endsWith('.ts'))
	.filter((f) => reachesAppSource(path.join(scriptsDir, f)))
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
