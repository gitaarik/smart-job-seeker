/**
 * Server-side loading of per-profile resume/CV templates: the `document` kind
 * of `presentation_templates`.
 *
 * Every function here pins `kind` itself and none of them takes it as a
 * parameter, so no call site can forget the filter. The loading itself,
 * including folding `presentation_template_assets` rows back into `config`,
 * is shared with the portfolio kind in `presentation-templates.ts`.
 */

import {
	documentSections,
	templateForStorage,
	type DocumentSections,
	type ResumeTemplate,
	type ResumeTemplateConfig
} from '$lib/resume-templates';
import {
	loadTemplateOfKind,
	loadTemplatesOfKind,
	isTemplateOwnedOfKind
} from './presentation-templates';

export { foldAssetsIntoConfig } from './presentation-templates';

const KIND = 'document' as const;

/** All published CV templates for a profile, in sort order. */
export async function getResumeTemplatesForProfile(profileId: number): Promise<ResumeTemplate[]> {
	return loadTemplatesOfKind<ResumeTemplateConfig>(profileId, KIND);
}

/** A single published CV template by slug, or null. */
export async function getResumeTemplate(
	profileId: number,
	slug: string
): Promise<ResumeTemplate | null> {
	return loadTemplateOfKind<ResumeTemplateConfig>(profileId, KIND, slug);
}

/**
 * What a document sent in this template prints; see documentSections.
 *
 * Read by slug, so the slug must be a `document` one. Since the portfolio kind
 * joined `presentation_templates` a slug no longer identifies a template on its
 * own: the unique key is (profile, kind, slug), and "citrus" may name a
 * document template and a theme at once. Every caller reads it out of a
 * document-only column (`profile_exports.template`,
 * `applications.cv_template_sent`), which is a contract rather than something
 * the types enforce; a portfolio theme is not a document and the question does
 * not apply to it.
 *
 * A slug naming no published template gets the built-in layout's answer,
 * because that is what renders for it.
 */
export async function documentSectionsFor(
	profileId: number,
	slug: string | null | undefined
): Promise<DocumentSections> {
	const stored = templateForStorage(slug);
	return documentSections(stored ? await getResumeTemplate(profileId, stored) : null);
}

/** Whether a CV template id belongs to this profile. */
export async function isTemplateOwned(profileId: number, templateId: number): Promise<boolean> {
	return isTemplateOwnedOfKind(profileId, KIND, templateId);
}
