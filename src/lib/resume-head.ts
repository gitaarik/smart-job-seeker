/**
 * `<title>` and meta description for the public resume and CV pages.
 *
 * The share link is what gets pasted into LinkedIn, Slack and WhatsApp, and
 * the preview those render is built from these two tags — so they carry the
 * headline (title and subtitle), not just the name.
 */
export interface ResumeHeadProfile {
	name: string | null;
	title: string | null;
	subtitle: string | null;
}

const clean = (value: string | null | undefined) => value?.trim() ?? '';

/** "Rik Wanders — Senior Full-Stack Engineer"; the name alone when there is no title. */
export function resumeDocumentTitle(profile: ResumeHeadProfile): string {
	return [clean(profile.name), clean(profile.title)].filter(Boolean).join(' — ');
}

/**
 * "Senior Full-Stack Engineer — Python / Node.js web applications at scale";
 * falls back to the name when the profile has no headline at all.
 */
export function resumeDocumentDescription(profile: ResumeHeadProfile): string {
	const headline = [clean(profile.title), clean(profile.subtitle)].filter(Boolean).join(' — ');
	return headline || clean(profile.name);
}
