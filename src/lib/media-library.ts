/**
 * The media library's shared vocabulary: what the server stores and the page
 * shows, in one place both sides import.
 *
 * See planning/MEDIA-LIBRARY.md. In short: an upload's original is kept once,
 * private and with its pixels exact; everything a slot or a platform gets is a
 * rendition cut from it; a preset is what a platform asks for.
 */

/** What an item is for. Decides where the page files it and which presets it offers first. */
export const MEDIA_KINDS = ['photo', 'banner', 'logo', 'icon', 'other'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const MEDIA_KIND_LABELS: Record<MediaKind, string> = {
	photo: 'Photos',
	banner: 'Banners',
	logo: 'Logos',
	icon: 'Icons',
	other: 'Other'
};

export function isMediaKind(value: unknown): value is MediaKind {
	return typeof value === 'string' && (MEDIA_KINDS as readonly string[]).includes(value);
}

/** What a rendition can be written as. Every platform takes at least one of these. */
export const OUTPUT_FORMATS = ['jpeg', 'png', 'webp'] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

export function isOutputFormat(value: unknown): value is OutputFormat {
	return typeof value === 'string' && (OUTPUT_FORMATS as readonly string[]).includes(value);
}

export const OUTPUT_EXTENSIONS: Record<OutputFormat, string> = {
	jpeg: '.jpg',
	png: '.png',
	webp: '.webp'
};

/** How a platform crops what it shows. */
export const MEDIA_MASKS = ['none', 'circle', 'rounded'] as const;
export type MediaMask = (typeof MEDIA_MASKS)[number];

export function isMediaMask(value: unknown): value is MediaMask {
	return typeof value === 'string' && (MEDIA_MASKS as readonly string[]).includes(value);
}

/**
 * A rectangle on a preset, in the preset's own pixels.
 *
 * Two kinds, because platforms do two different things to a picture:
 *
 * - `covered`: something sits on top of this part. LinkedIn puts the profile
 *   photo over the lower left of the background, which is why a background
 *   made for it leaves that corner empty.
 * - `safe`: the only part every screen shows. Anything outside it is cut off
 *   somewhere, a phone layout usually.
 */
export interface SafeZone {
	kind: 'covered' | 'safe';
	x: number;
	y: number;
	w: number;
	h: number;
	label?: string;
}

/** A crop in pixels of the upright original. */
export interface Crop {
	x: number;
	y: number;
	w: number;
	h: number;
}

/** A preset as the page reads it. */
export interface MediaPresetView {
	id: number;
	key: string | null;
	/** False for the presets every profile shares; true for one this profile added. */
	own: boolean;
	platform: string;
	slot: string;
	kind: MediaKind;
	width: number;
	height: number;
	formats: OutputFormat[];
	maxBytes: number | null;
	mask: MediaMask;
	safeZone: SafeZone[];
	note: string | null;
	sourceUrl: string | null;
	verifiedOn: string | null;
}

/** "LinkedIn background", the way the page names a preset. */
export function presetName(preset: { platform: string; slot: string }): string {
	return `${preset.platform} ${preset.slot.toLowerCase()}`;
}

/**
 * The largest crop of a `width` x `height` picture with the given aspect,
 * centred. The starting crop for a preset nobody has cropped yet.
 */
export function centredCrop(width: number, height: number, aspect: number | null): Crop {
	if (!aspect || !Number.isFinite(aspect) || aspect <= 0) {
		return { x: 0, y: 0, w: width, h: height };
	}
	let w = width;
	let h = Math.round(width / aspect);
	if (h > height) {
		h = height;
		w = Math.round(height * aspect);
	}
	w = Math.max(1, Math.min(width, w));
	h = Math.max(1, Math.min(height, h));
	return { x: Math.floor((width - w) / 2), y: Math.floor((height - h) / 2), w, h };
}

/**
 * A crop pulled back inside the picture and rounded to whole pixels, so a
 * value from a form or a drag can be stored as it is.
 */
export function clampCrop(crop: Crop, width: number, height: number): Crop {
	const w = Math.max(1, Math.min(width, Math.round(crop.w)));
	const h = Math.max(1, Math.min(height, Math.round(crop.h)));
	const x = Math.max(0, Math.min(width - w, Math.round(crop.x)));
	const y = Math.max(0, Math.min(height - h, Math.round(crop.y)));
	return { x, y, w, h };
}

/** Why a rendition may not be what the platform wants, said before it is downloaded. */
export interface RenditionWarning {
	kind: 'enlarged' | 'too-big' | 'size-changed';
	message: string;
}

/**
 * What to say about cutting `crop` to a preset, before anything is rendered.
 *
 * Enlarging is the one a person cannot see in the crop editor: the picture
 * looks fine at screen size and goes up soft.
 */
export function cropWarnings(crop: Crop, preset: { width: number; height: number }): RenditionWarning[] {
	const warnings: RenditionWarning[] = [];
	if (crop.w < preset.width || crop.h < preset.height) {
		warnings.push({
			kind: 'enlarged',
			message: `The crop is ${crop.w}x${crop.h}, smaller than the ${preset.width}x${preset.height} this needs, so it would be enlarged and look soft.`
		});
	}
	return warnings;
}

export function formatBytes(bytes: number): string {
	if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${bytes} B`;
}
