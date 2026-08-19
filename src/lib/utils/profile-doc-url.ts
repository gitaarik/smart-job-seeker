/**
 * Build URLs for public profile document pages (resume/cv).
 */

export type DocType = 'resume' | 'cv';

interface ProfileDocUrlOptions {
	profileSlug: string;
	docType: DocType;
	versionSlug?: string | null;
	isPublicVersion?: boolean;
	pdf?: boolean;
	/** Presentation template id; the default template is omitted from the URL. */
	template?: string | null;
	/** Language code; the base English (`en`) is omitted from the URL. */
	locale?: string | null;
}

/**
 * Flat identity of one rendered document: type, version, template, language.
 *
 * A stored PDF export is keyed by all four, and nothing renders one on demand,
 * so "is there a PDF for what I picked" is a set-membership question the server
 * answers once and the client asks on every change of any of the four.
 *
 * Normalises both lenses to their storage form — the built-in template and the
 * base English are `null` in `profile_exports`, while the UI carries them as
 * `'default'` and `'en'` — so either side can build a key from what it has.
 */
export function exportKey(
	docType: string,
	versionSlug: string | null | undefined,
	template: string | null | undefined,
	locale: string | null | undefined
): string {
	const t = template && template !== 'default' ? template : '';
	const l = locale && locale !== 'en' ? locale : '';
	return `${docType}|${versionSlug ?? ''}|${t}|${l}`;
}

export function profileDocUrl(options: ProfileDocUrlOptions): string {
	const { profileSlug, docType, versionSlug, isPublicVersion, pdf, template, locale } = options;
	const path = `/p/${profileSlug}/${docType}${pdf ? '.pdf' : ''}`;

	const params = new URLSearchParams();
	if (versionSlug && !isPublicVersion) {
		params.set('version', versionSlug);
	}
	if (template && template !== 'default') {
		params.set('template', template);
	}
	if (locale && locale !== 'en') {
		params.set('lang', locale);
	}

	const qs = params.toString();
	return qs ? `${path}?${qs}` : path;
}
