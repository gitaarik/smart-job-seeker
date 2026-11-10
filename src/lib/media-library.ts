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
export function cropWarnings(
	crop: Crop,
	preset: { width: number; height: number }
): RenditionWarning[] {
	const warnings: RenditionWarning[] = [];
	if (crop.w < preset.width || crop.h < preset.height) {
		warnings.push({
			kind: 'enlarged',
			message: `The crop is ${crop.w}x${crop.h}, smaller than the ${preset.width}x${preset.height} this needs, so it would be enlarged and look soft.`
		});
	}
	return warnings;
}

/**
 * A size in decimal units, the way platforms state their limits: LinkedIn's
 * "8 MB" is 8,000,000 bytes here, not 7.6 binary megabytes.
 */
export function formatBytes(bytes: number): string {
	if (bytes >= 1_000_000) return `${Number((bytes / 1_000_000).toFixed(1))} MB`;
	if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} KB`;
	return `${bytes} B`;
}

/**
 * An image slot on the profile: a place that shows one picture.
 *
 * `maxEdge` is the longest side the slot's rendition is drawn at, never
 * enlarging. It was 800 for every slot when each kept its own copy; banners
 * and a theme's hero are drawn larger now that the original is kept to draw
 * them from. `aspect` is the shape the crop editor starts from, where the slot
 * has one.
 */
export interface MediaSlotSpec {
	label: string;
	kind: MediaKind;
	maxEdge: number;
	aspect?: number;
}

/** The slots on profile rows, by entity type and slot name. */
export const ENTITY_MEDIA_SLOTS = {
	profile: {
		photo: { label: 'Profile photo', kind: 'photo', maxEdge: 800 }
	},
	work_experience: {
		logo: { label: 'Logo', kind: 'logo', maxEdge: 800 },
		banner: { label: 'Banner', kind: 'banner', maxEdge: 1600 }
	},
	education: {
		logo: { label: 'Logo', kind: 'logo', maxEdge: 800 },
		banner: { label: 'Banner', kind: 'banner', maxEdge: 1600 }
	},
	side_project: {
		logo: { label: 'Logo', kind: 'logo', maxEdge: 800 },
		image: { label: 'Image', kind: 'other', maxEdge: 800 },
		banner: { label: 'Banner', kind: 'banner', maxEdge: 1600 }
	}
} as const satisfies Record<string, Record<string, MediaSlotSpec>>;

export type MediaEntityType = keyof typeof ENTITY_MEDIA_SLOTS;

export function entitySlotSpec(entityType: string, slot: string): MediaSlotSpec | null {
	const slots = (ENTITY_MEDIA_SLOTS as Record<string, Record<string, MediaSlotSpec>>)[entityType];
	return slots?.[slot] ?? null;
}

/** A portfolio theme's image slots. */
export const THEME_MEDIA_SLOTS = {
	logo: { label: 'Logo', kind: 'logo', maxEdge: 800 },
	hero: { label: 'Hero', kind: 'banner', maxEdge: 2400 },
	ogImage: { label: 'Link preview', kind: 'banner', maxEdge: 1200, aspect: 1200 / 630 },
	favicon: { label: 'Favicon', kind: 'icon', maxEdge: 512, aspect: 1 },
	photo: { label: 'Photo', kind: 'photo', maxEdge: 800 },
	thumbnail: { label: 'Thumbnail', kind: 'other', maxEdge: 800 }
} as const satisfies Record<string, MediaSlotSpec>;

export type ThemeMediaSlot = keyof typeof THEME_MEDIA_SLOTS;

export function isThemeMediaSlot(value: string): value is ThemeMediaSlot {
	return Object.prototype.hasOwnProperty.call(THEME_MEDIA_SLOTS, value);
}

/** The size a slot draws a crop at: the crop itself, scaled down to fit `maxEdge`. */
export function slotOutputSize(crop: Crop, maxEdge: number): { width: number; height: number } {
	const scale = Math.min(1, maxEdge / Math.max(crop.w, crop.h));
	return {
		width: Math.max(1, Math.round(crop.w * scale)),
		height: Math.max(1, Math.round(crop.h * scale))
	};
}

/** Where a rendition is served: the same public route as template artwork. */
export function renditionUrl(id: string | null | undefined): string | null {
	return id ? `/assets/${id}` : null;
}

/** An item as the page and the slot picker read it. */
export interface MediaItemView {
	id: number;
	kind: MediaKind;
	label: string | null;
	width: number;
	height: number;
	format: string;
	hasAlpha: boolean;
	/** Size of the stored original. */
	bytes: number | null;
	replacesId: number | null;
	templateId: number | null;
	dateCreated: string | null;
	previewUrl: string;
	originalUrl: string;
}

export function itemPreviewUrl(id: number, maxEdge = 480): string {
	return `/api/media/items/${id}/preview?w=${maxEdge}`;
}

/** A banner template's picture slots. */
export const BANNER_MEDIA_SLOTS = {
	logo: { label: 'Logo', kind: 'logo', maxEdge: 800 },
	background: { label: 'Background', kind: 'banner', maxEdge: 2400 }
} as const satisfies Record<string, MediaSlotSpec>;

export type BannerMediaSlot = keyof typeof BANNER_MEDIA_SLOTS;

export function isBannerMediaSlot(value: string): value is BannerMediaSlot {
	return Object.prototype.hasOwnProperty.call(BANNER_MEDIA_SLOTS, value);
}
