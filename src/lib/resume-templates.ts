/**
 * Resume/CV templates: the `document` kind of `presentation_templates`.
 *
 * Templates are DB-backed (per profile) — see the `presentation_templates`
 * table, which also holds the `portfolio` kind (`portfolio-themes.ts`). The
 * repo ships only a generic, brand-neutral renderer; all branding, fonts,
 * uploaded asset references, layout rules and the optional sections a template
 * prints (DocumentSections) live in a template's `config`.
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
	/**
	 * Which optional parts of the document this template prints. A part left
	 * out gives its room on the page to the rest, and tailoring stops weighing
	 * it. Unset parts take TEMPLATE_DEFAULT_SECTIONS; see DocumentSections.
	 */
	sections?: Partial<DocumentSections>;
	/** File ref for the switcher thumbnail. */
	thumbnail?: string;
}

/**
 * The parts of a document a template may print or leave out.
 *
 * Asked of the template rather than of which renderer draws it, because more
 * than the renderer needs the answer before anything renders: coverage, the
 * tailoring run and its review all decide what a document shows, and each gets
 * a different right answer per template. A run that counted side projects
 * against the page of a template with no projects section trimmed real lines
 * to make room nothing used (application 92, 2026-10-11). Same lesson as
 * `page-fit.ts`: a version fitted to two pages came out of a branded template
 * at three, because the promise was about a different document.
 *
 * Only the parts something decides about are listed. Another one joins with
 * its key here, its value in each of the answers below, and the renderer's check.
 */
export interface DocumentSections {
	/** A role's technology line ("TECH: Python, Django"). */
	technologies: boolean;
	/** The side projects: name, dates, link and summary. */
	sideProjects: boolean;
}

/** What the built-in layout (ProfileDisplay) prints. It has no config to change it. */
export const BUILT_IN_SECTIONS: Readonly<DocumentSections> = {
	technologies: false,
	sideProjects: true
};

/**
 * What a template prints when its config does not say: every part the generic
 * renderer has (Rik, 2026-10-11: side projects are on for new templates).
 * Templates made before then were made without a projects section; they say
 * so in their config (LEGACY_TEMPLATE_SECTIONS), which is why changing this
 * changed none of them. Change it again the same way.
 */
export const TEMPLATE_DEFAULT_SECTIONS: Readonly<DocumentSections> = {
	technologies: true,
	sideProjects: true
};

/**
 * What the generic renderer printed before a template could choose (until
 * 2026-10-11): no side projects, because it had no such section. Migration
 * 0075 wrote it into every template that existed, and the importer writes it
 * into one from an archive written before then (withSections).
 */
export const LEGACY_TEMPLATE_SECTIONS: Readonly<DocumentSections> = {
	technologies: true,
	sideProjects: false
};

/**
 * A document template's config with `sections` written in, when it has none.
 *
 * An exported config always says what it prints (the export writes in what
 * the defaults gave it), so one that does not was written before templates
 * could choose. That is how the importer tells an old archive from a template
 * that leans on today's defaults, which would otherwise read the same. A
 * config that is not an object is left alone.
 */
export function withSections(config: unknown, sections: Readonly<DocumentSections>): unknown {
	if (
		config !== null &&
		config !== undefined &&
		(typeof config !== 'object' || Array.isArray(config))
	)
		return config;
	const object = (config ?? {}) as Record<string, unknown>;
	const current = object.sections;
	if (current && typeof current === 'object' && !Array.isArray(current)) return config;
	return { ...object, sections: { ...sections } };
}

/**
 * What a document prints in this template. Null is the built-in layout, which
 * is also what renders when a recorded template no longer exists. The config
 * is jsonb, so anything but a boolean reads as unset.
 */
export function documentSections(
	template: { config?: ResumeTemplateConfig | null } | null | undefined
): DocumentSections {
	if (!template) return { ...BUILT_IN_SECTIONS };
	const chosen: Partial<Record<keyof DocumentSections, unknown>> = template.config?.sections ?? {};
	const pick = (key: keyof DocumentSections): boolean => {
		const value = chosen[key];
		return typeof value === 'boolean' ? value : TEMPLATE_DEFAULT_SECTIONS[key];
	};
	return { technologies: pick('technologies'), sideProjects: pick('sideProjects') };
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
