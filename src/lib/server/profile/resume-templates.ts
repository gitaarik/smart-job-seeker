/**
 * Server-side loading of per-profile resume/CV templates: the `document` kind
 * of `presentation_templates`.
 *
 * Every function here pins `kind` itself and none of them takes it as a
 * parameter, so no call site can forget the filter. The loading itself,
 * including folding `presentation_template_assets` rows back into `config`,
 * is shared with the portfolio kind in `presentation-templates.ts`.
 */

import type { ResumeTemplate, ResumeTemplateConfig } from '$lib/resume-templates';
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

/** Whether a CV template id belongs to this profile. */
export async function isTemplateOwned(profileId: number, templateId: number): Promise<boolean> {
	return isTemplateOwnedOfKind(profileId, KIND, templateId);
}
