// Valid values for profile token fields
/**
 * What a share link points at. `portfolio` renders the public site behind the
 * token instead of a document, so a portfolio can be shown to one person
 * before (or without) the profile's public URL being switched on at all.
 */
export const VALID_FORMATS = ['resume', 'cv', 'portfolio'] as const;
export const VALID_VIEW_MODES = ['html', 'pdf'] as const;

export const DEFAULT_FORMAT = 'resume';
export const DEFAULT_VIEW_MODE = 'html';

export type TokenFormat = (typeof VALID_FORMATS)[number];
export type TokenViewMode = (typeof VALID_VIEW_MODES)[number];

export function isValidFormat(value: string): value is TokenFormat {
	return VALID_FORMATS.includes(value as TokenFormat);
}

export function isValidViewMode(value: string): value is TokenViewMode {
	return VALID_VIEW_MODES.includes(value as TokenViewMode);
}
