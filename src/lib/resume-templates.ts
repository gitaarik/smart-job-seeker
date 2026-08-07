/**
 * Resume/CV presentation templates.
 *
 * Templates are DB-backed (per profile) — see the `resume_templates` table.
 * The repo ships only a generic, brand-neutral renderer; all branding, fonts,
 * uploaded asset references and layout rules live in a template's `config`.
 *
 * The built-in "default" template is the standard ProfileDisplay layout and is
 * represented as `null` on `profile_exports.template` for backward compat.
 */

export const DEFAULT_TEMPLATE_ID = 'default';

/** Font families the generic renderer bundles (config picks by family name). */
export type TemplateFont = 'Poppins' | 'Carlito' | 'Noto Sans';

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

/** URL for an uploaded asset file (served by the app's /assets/[uuid] route). */
export function assetUrl(fileId: string | null | undefined): string | null {
	return fileId ? `/assets/${fileId}` : null;
}

/** Value stored on profile_exports.template (null for the default template). */
export function templateForStorage(slug: string | null | undefined): string | null {
	const s = (slug ?? '').trim();
	return !s || s === DEFAULT_TEMPLATE_ID ? null : s;
}
