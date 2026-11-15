/**
 * The legal texts this instance publishes, read from a directory beside the
 * app rather than from the code.
 *
 * oss is public and carries no operator's name, address or terms, so the
 * texts are the deployment's: Smart Job Seeker's live in cloud's `legal/`,
 * mounted at `/app/legal` in dev and copied there in the production image.
 * `SJS_LEGAL_DIR` points elsewhere. The directory holds:
 *
 * - `meta.json`: `{ "draft": bool, "terms": "<version>",
 *   "withdrawalWaiver": { "version": "<version>", "text": "<sentence>" } }`
 * - `terms.md`, `privacy.md`: the pages, as markdown.
 *
 * A version is the date the text last changed in substance; bump it when
 * people should agree again. Signup and the invite forms refuse any version
 * but the current one, so what an account agreed to is exactly what was on
 * the page.
 *
 * No directory means no terms: a self-hosted instance asks nobody to agree to
 * anything, and its signup shows no checkbox. Read on every call, which is
 * cheap at the rate signups and legal page views happen, and means an edited
 * text is live without a restart.
 */

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { getEnv } from '$lib/tools/get-env';

export interface LegalMeta {
	/** True while the texts are placeholders; the pages say so at the top. */
	draft: boolean;
	terms: string;
	withdrawalWaiver: { version: string; text: string } | null;
}

export type LegalPage = 'terms' | 'privacy';

function legalDir(): string {
	return getEnv('SJS_LEGAL_DIR', '') || resolve(process.cwd(), 'legal');
}

function readOptional(name: string): string | null {
	try {
		return readFileSync(join(legalDir(), name), 'utf8');
	} catch (e) {
		if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
		throw e;
	}
}

/**
 * The versions, or null when this instance publishes no terms. A file that is
 * there but malformed throws: quietly treating it as "no terms" would open
 * signup without the checkbox on the instance that meant to have one.
 */
export function readLegalMeta(): LegalMeta | null {
	const raw = readOptional('meta.json');
	if (raw === null) return null;
	const meta = JSON.parse(raw) as Partial<LegalMeta>;
	if (typeof meta.terms !== 'string' || !meta.terms) {
		throw new Error(`${legalDir()}/meta.json has no "terms" version`);
	}
	const waiver = meta.withdrawalWaiver;
	if (waiver && (typeof waiver.version !== 'string' || typeof waiver.text !== 'string')) {
		throw new Error(`${legalDir()}/meta.json has a malformed "withdrawalWaiver"`);
	}
	return { draft: meta.draft !== false, terms: meta.terms, withdrawalWaiver: waiver ?? null };
}

/** The terms version a new account must accept, or null when there are none. */
export function termsVersion(): string | null {
	return readLegalMeta()?.terms ?? null;
}

/** One page's markdown, or null when this instance does not publish it. */
export function readLegalPage(page: LegalPage): string | null {
	return readOptional(`${page}.md`);
}

/**
 * What a legal page needs to render: the text as HTML, and whether it is
 * still a draft. Null when this instance does not publish the page.
 */
export async function loadLegalPage(
	page: LegalPage
): Promise<{ html: string; draft: boolean } | null> {
	const markdown = readLegalPage(page);
	if (markdown === null) return null;
	const { marked } = await import('marked');
	// The operator's own text, not user input, so its HTML renders as written,
	// as the guide's does.
	return {
		html: marked.parse(markdown, { async: false }),
		draft: readLegalMeta()?.draft ?? true
	};
}
