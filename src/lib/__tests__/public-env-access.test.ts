/**
 * `import.meta.env.PUBLIC_*` is always undefined here, and nothing says so.
 *
 * SvelteKit does not point Vite's `envPrefix` at `PUBLIC_`, so
 * `import.meta.env` carries only Vite's own keys — `BASE_URL`, `DEV`, `MODE`,
 * `PROD`, `SSR` and anything `VITE_`-prefixed. A `PUBLIC_` variable reaches
 * the browser through `$env/dynamic/public` (serialized per request by the
 * server) or `$env/static/public` (inlined at build), and through nothing else.
 *
 * Read it the wrong way and there is no error, no warning and no missing
 * import: the value is simply `undefined`, and whatever it guarded silently
 * does not happen. That is not hypothetical — `hooks.client.ts` initialised
 * Sentry behind `import.meta.env.PUBLIC_SENTRY_DSN` for its entire life, so
 * `Sentry.init` never ran and `handleError` was `undefined` in every
 * environment. 450 events in GlitchTip, all `platform: node`, not one from a
 * browser. The container had the DSN, the SDK was installed, the CSP allowed
 * the host, and the server half of the same integration reported normally.
 *
 * A unit test cannot catch that — the code is correct-looking and the value it
 * reads is a build-time fact. Scanning the source can, so this test does.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(process.cwd(), 'src');

/** Everything Vite actually defines, plus its own prefix. */
const VITE_OWN = /^(BASE_URL|DEV|MODE|PROD|SSR|LEGACY|VITE_[A-Z0-9_]*)$/;

const EXTENSIONS = /\.(ts|js|svelte|svelte\.ts)$/;

function sourceFiles(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			out.push(...sourceFiles(full));
		} else if (EXTENSIONS.test(entry)) {
			out.push(full);
		}
	}
	return out;
}

/**
 * Strip comments, so that explaining the trap does not trip it — this file and
 * the fixed `hooks.client.ts` both name it in prose.
 */
function withoutComments(source: string): string {
	return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const files = sourceFiles(SRC);

describe('import.meta.env', () => {
	it('finds the source tree to scan', () => {
		expect(files.length).toBeGreaterThan(500);
	});

	it('is never read for a PUBLIC_ variable', () => {
		const offenders = files.filter((f) =>
			/import\s*\.\s*meta\s*\.\s*env\s*(\.\s*PUBLIC_|\[\s*['"`]PUBLIC_)/.test(
				withoutComments(readFileSync(f, 'utf8'))
			)
		);

		expect(
			offenders.map((f) => relative(process.cwd(), f)),
			'PUBLIC_ variables are undefined on import.meta.env; read them from $env/dynamic/public'
		).toEqual([]);
	});

	it('is never read for a key Vite does not define', () => {
		const offenders: string[] = [];
		for (const f of files) {
			const source = withoutComments(readFileSync(f, 'utf8'));
			for (const [, key] of source.matchAll(
				/import\s*\.\s*meta\s*\.\s*env\s*\.\s*([A-Za-z0-9_]+)/g
			)) {
				if (!VITE_OWN.test(key)) offenders.push(`${relative(process.cwd(), f)}: ${key}`);
			}
		}

		expect(
			offenders,
			'only BASE_URL/DEV/MODE/PROD/SSR/VITE_* exist on import.meta.env; app config comes from $env or getEnv'
		).toEqual([]);
	});
});
