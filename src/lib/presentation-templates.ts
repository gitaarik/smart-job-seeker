/**
 * Presentation templates: the shared half of how a profile is dressed for an
 * audience.
 *
 * One table, `presentation_templates`, holds two kinds. A `document` template
 * dresses a printed resume/CV and its vocabulary lives in `resume-templates.ts`;
 * a `portfolio` theme dresses the public site and lives in `portfolio-themes.ts`.
 * What genuinely belongs to both is here: the kind itself, the bundled fonts,
 * and how an uploaded asset becomes a URL.
 *
 * The table stores `config` as an uninterpreted jsonb and asset slots as
 * free-form string keys, which is why the two kinds can share it without
 * either one constraining the other. See the schema comment for why that is
 * one table rather than two.
 */

/** What a template dresses. The `kind` column stores exactly these. */
export const TEMPLATE_KINDS = ['document', 'portfolio'] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

export const DEFAULT_TEMPLATE_KIND: TemplateKind = 'document';

export function isTemplateKind(value: string): value is TemplateKind {
	return TEMPLATE_KINDS.includes(value as TemplateKind);
}

/** Font families the generic renderer bundles (config picks by family name). */
export type TemplateFont = 'Poppins' | 'Carlito' | 'Noto Sans';

/**
 * The columns every kind has. `config` is deliberately unknown here: what it
 * means is the kind's business, and each kind's loader narrows it.
 */
export interface PresentationTemplateRow {
	id: number;
	kind: TemplateKind;
	name: string;
	slug: string;
	config: unknown;
}

/** URL for an uploaded asset file (served by the app's /assets/[uuid] route). */
export function assetUrl(fileId: string | null | undefined): string | null {
	return fileId ? `/assets/${fileId}` : null;
}
