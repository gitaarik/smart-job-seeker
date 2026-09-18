/**
 * Resume/CV templates: the `document` kind of `presentation_templates`.
 *
 * Templates are DB-backed (per profile) — see the `presentation_templates`
 * table, which also holds the `portfolio` kind (`portfolio-themes.ts`). The
 * repo ships only a generic, brand-neutral renderer; all branding, fonts,
 * uploaded asset references and layout rules live in a template's `config`.
 *
 * The built-in "default" template is the standard ProfileDisplay layout and is
 * represented as `null` on `profile_exports.template` for backward compat.
 */

import { assetUrl, type TemplateFont } from './presentation-templates';

// Both belong to every kind and are defined in presentation-templates.ts;
// they are re-exported because the renderers and routes already import them
// from here, and moving that many imports would bury the actual change.
export { assetUrl };
export type { TemplateFont };

export const DEFAULT_TEMPLATE_ID = 'default';

export interface ResumeTemplateAssets {
	/** Header badge/logo (transparent PNG), centered at the top of each page. */
	badge?: string;
	/** Tiled decorative background for the on-screen sheet. */
	screenBackground?: string;
	/** Full-page background (decoration + footer bar) painted per printed page. */
	printBackground?: string;
	/** Footer bar shown once at the bottom of the on-screen sheet. */
	footer?: string;
	/** Divider graphic under the subtitle (e.g. a wave). */
	divider?: string;
}

export interface ResumeTemplateConfig {
	/** Accent colour (dividers, bullet dots, etc.). */
	accent?: string;
	fonts?: { heading?: TemplateFont; body?: TemplateFont };
	assets?: ResumeTemplateAssets;
	rules?: {
		/** Append the work-experience location to the headline ("… in {location}."). */
		appendLocationToHeadline?: boolean;
	};
	/**
	 * Per-field contact overrides — brand contact points that replace the
	 * profile's own value when this template is rendered (e.g. a consultancy
	 * email). Keyed by contact field key (see resume-contact-fields.ts). A field
	 * hidden by a version's `hide:` toggle stays hidden regardless.
	 */
	contact?: Record<string, string>;
	/** File ref for the switcher thumbnail. */
	thumbnail?: string;
}

export interface ResumeTemplate {
	id: number;
	name: string;
	slug: string;
	config: ResumeTemplateConfig;
}

/** Value stored on profile_exports.template (null for the default template). */
export function templateForStorage(slug: string | null | undefined): string | null {
	const s = (slug ?? '').trim();
	return !s || s === DEFAULT_TEMPLATE_ID ? null : s;
}

/**
 * Whether this template's renderer prints a role's technology line.
 *
 * The generic renderer does (`StructuredResume.tech()`); the built-in default
 * layout prints no technologies anywhere. It has to be asked outside the
 * renderer because "is this skill on the page" is a per-template question, and
 * everything that predicts what a document shows — coverage, and the tailoring
 * run's decision to surface a required skill — gets a different right answer
 * per template. Same lesson as `page-fit.ts`: a version fitted to two pages
 * came out of a branded template at three, and nothing errored, because the
 * promise was simply about a different document.
 *
 * Every DB-backed template goes through the generic renderer, so the predicate
 * is the same one storage uses. If a template config ever gains a rule that
 * suppresses the tech line, this is where it is read.
 *
 * The slug must be a `document` one. Since the portfolio kind joined
 * `presentation_templates` a slug no longer identifies a template on its own —
 * the unique key is (profile, kind, slug), and "citrus" may name a document
 * template and a theme at once. Answering from the slug alone is safe only
 * because every caller reads it out of a document-only column
 * (`profile_exports.template`, `applications.cv_template_sent`), and that is a
 * contract rather than something the types enforce. A caller holding a
 * template of unknown kind must narrow it before asking; a portfolio theme is
 * not a document and the question does not apply to it.
 */
export function templatePrintsTechnologies(documentSlug: string | null | undefined): boolean {
	return templateForStorage(documentSlug) !== null;
}
