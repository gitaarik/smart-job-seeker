/**
 * Drawing banner templates (planning/MEDIA-LIBRARY.md, decision 6).
 *
 * A banner template is a layout in a portfolio theme's palette and fonts. This
 * builds it as one self-contained page per preset, at the preset's exact size,
 * and has the headless browser that prints CVs (`launchBrowser`) photograph
 * it. Pictures go in as data URIs; the fonts load from the app itself, as they
 * do for a printed CV.
 *
 * Each drawing is stored as a library item (its original is the drawing) with
 * a full-frame rendition for the preset, and replaces the item the last
 * drawing for that preset made. So a banner changed in words or theme is drawn
 * at every size at once, and a platform still showing the old drawing shows up
 * in the media page's "still showing an older version" list.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import {
	media_items,
	media_presets,
	media_renditions,
	presentation_template_assets,
	presentation_templates,
	profiles
} from '$lib/server/db/schema';
import { getFile } from '$lib/server/files';
import { launchBrowser } from '$lib/server/browser/utils';
import { loadFieldVariants } from '$lib/server/profile/field-variants';
import { foldAssetsIntoConfig } from '$lib/server/profile/presentation-templates';
import { bannerAlignment, bannerLine, type BannerTemplateConfig } from '$lib/banner-templates';
import { resolvePalette, type PortfolioThemeConfig } from '$lib/portfolio-themes';
import { presetName, type SafeZone } from '$lib/media-library';
import { createMediaItem } from './items';
import { chooseFormat, ensureRendered, findOrCreateRendition } from './renditions';

/** Where the running app serves its fonts, as the PDF generator reaches it. */
const APP_INTERNAL_URL = 'http://localhost:5173';
const FILES_DIR = join(process.cwd(), 'uploads', 'files');

export interface BannerWords {
	name: string;
	line: string;
	tagline: string;
}

export interface BannerLook {
	background: string;
	text: string;
	accent: string;
	muted: string;
	headingFont: string;
	bodyFont: string;
}

export interface BannerPictures {
	/** Data URIs. */
	logo: string | null;
	background: string | null;
}

const FONT_FACES = `
@font-face { font-family: 'Noto Sans'; font-weight: 400; src: url('/fonts/NotoSans/NotoSans-Regular.ttf'); }
@font-face { font-family: 'Noto Sans'; font-weight: 600; src: url('/fonts/NotoSans/NotoSans-SemiBold.ttf'); }
@font-face { font-family: 'Noto Sans'; font-weight: 700; src: url('/fonts/NotoSans/NotoSans-Bold.ttf'); }
@font-face { font-family: 'Poppins'; font-weight: 800; src: url('/fonts/poppins-extrabold.woff2') format('woff2'); }
@font-face { font-family: 'Carlito'; font-weight: 400; src: url('/fonts/carlito-regular.woff2') format('woff2'); }
@font-face { font-family: 'Carlito'; font-weight: 700; src: url('/fonts/carlito-bold.woff2') format('woff2'); }
`;

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/** A CSS colour from a theme, or the fallback when it is not a plain hex. */
function colour(value: string | undefined, fallback: string): string {
	return value && /^#[0-9a-f]{3,8}$/i.test(value) ? value : fallback;
}

/**
 * The box the words may use: inside the platform's `safe` zone when it has
 * one, and clear of a `covered` zone on the side the words sit.
 */
export function contentBox(
	width: number,
	height: number,
	zones: SafeZone[],
	align: 'left' | 'center' | 'right'
): { left: number; top: number; right: number; bottom: number } {
	const padX = Math.round(width * 0.05);
	const padY = Math.round(height * 0.12);
	let left = padX;
	let right = width - padX;
	let top = padY;
	let bottom = height - padY;
	for (const zone of zones) {
		if (zone.kind === 'safe') {
			left = Math.max(left, zone.x + padX / 2);
			right = Math.min(right, zone.x + zone.w - padX / 2);
			top = Math.max(top, zone.y + padY / 2);
			bottom = Math.min(bottom, zone.y + zone.h - padY / 2);
		}
	}
	for (const zone of zones) {
		if (zone.kind !== 'covered') continue;
		const coversLeft = zone.x < width / 2;
		if (coversLeft && align !== 'right') left = Math.max(left, zone.x + zone.w + padX / 2);
		if (!coversLeft && align !== 'left') right = Math.min(right, zone.x - padX / 2);
	}
	if (right - left < width * 0.3) {
		left = padX;
		right = width - padX;
	}
	return { left, top, right, bottom };
}

/** The page the browser photographs: one banner, `width` x `height` pixels. */
export function bannerHtml(
	words: BannerWords,
	look: BannerLook,
	pictures: BannerPictures,
	options: {
		width: number;
		height: number;
		zones: SafeZone[];
		align: 'left' | 'center' | 'right';
		/** Where the fonts load from: the app as the browser reaches it. */
		baseUrl?: string;
	}
): string {
	const { width, height, zones, align, baseUrl = APP_INTERNAL_URL } = options;
	const box = contentBox(width, height, zones, align);
	const boxHeight = box.bottom - box.top;
	// Sized by the height the words have, and kept from running wider than the box.
	const nameSize = Math.round(
		Math.min(boxHeight * 0.3, (box.right - box.left) / Math.max(8, words.name.length * 0.58))
	);
	const lineSize = Math.round(nameSize * 0.5);
	const taglineSize = Math.round(nameSize * 0.36);
	const logoSize = Math.round(Math.min(boxHeight * 0.55, height * 0.42));
	const flexAlign = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
	const background = pictures.background
		? `<div class="bg" style="background-image:url('${pictures.background}')"></div><div class="veil"></div>`
		: `<div class="glow"></div>`;
	const logo = pictures.logo ? `<img class="logo" src="${pictures.logo}" alt="">` : '';

	return `<!doctype html>
<html><head><meta charset="utf-8"><base href="${escapeHtml(baseUrl)}/">
<style>
${FONT_FACES}
html, body { margin: 0; padding: 0; width: ${width}px; height: ${height}px; overflow: hidden; }
.banner { position: relative; width: ${width}px; height: ${height}px; background: ${look.background}; color: ${look.text}; font-family: '${look.bodyFont}', 'Noto Sans', sans-serif; }
.bg { position: absolute; inset: 0; background-size: cover; background-position: center; }
.veil { position: absolute; inset: 0; background: linear-gradient(${align === 'left' ? 90 : 270}deg, ${look.background}ee 0%, ${look.background}99 45%, ${look.background}00 100%); }
.glow { position: absolute; inset: 0; background: radial-gradient(circle at ${align === 'left' ? '85%' : '15%'} 50%, ${look.accent}33 0%, ${look.accent}00 55%); }
.content { position: absolute; left: ${box.left}px; top: ${box.top}px; width: ${box.right - box.left}px; height: ${boxHeight}px; display: flex; align-items: center; justify-content: ${flexAlign}; gap: ${Math.round(nameSize * 0.6)}px; }
.words { display: flex; flex-direction: column; align-items: ${flexAlign}; text-align: ${align}; gap: ${Math.round(nameSize * 0.12)}px; min-width: 0; }
.logo { height: ${logoSize}px; width: auto; max-width: ${Math.round((box.right - box.left) * 0.3)}px; object-fit: contain; flex-shrink: 0; }
.name { font-family: '${look.headingFont}', 'Noto Sans', sans-serif; font-weight: 800; font-size: ${nameSize}px; line-height: 1.05; color: ${look.text}; }
.rule { width: ${Math.round(nameSize * 1.4)}px; height: ${Math.max(2, Math.round(nameSize * 0.07))}px; background: ${look.accent}; border-radius: 2px; }
.line { font-weight: 600; font-size: ${lineSize}px; line-height: 1.2; color: ${look.text}; }
.tagline { font-weight: 400; font-size: ${taglineSize}px; line-height: 1.3; color: ${look.muted}; }
</style></head>
<body><div class="banner">${background}
<div class="content">${align === 'right' ? '' : logo}<div class="words">
<div class="name">${escapeHtml(words.name)}</div>
<div class="rule"></div>
${words.line ? `<div class="line">${escapeHtml(words.line)}</div>` : ''}
${words.tagline ? `<div class="tagline">${escapeHtml(words.tagline)}</div>` : ''}
</div>${align === 'right' ? logo : ''}</div>
</div></body></html>`;
}

function dataUri(bytes: Buffer, type: string): string {
	return `data:${type};base64,${bytes.toString('base64')}`;
}

/** A template asset's picture as a data URI: a rendition's drawn bytes, or a plain file. */
async function assetPicture(
	row: { file_id: string | null; rendition_id: string | null } | undefined
) {
	if (!row) return null;
	try {
		if (row.rendition_id) {
			const drawn = await ensureRendered(row.rendition_id);
			if (!drawn) return null;
			return dataUri(await readFile(join(FILES_DIR, drawn.filenameDisk)), drawn.type);
		}
		const fileId = row.file_id;
		if (fileId) {
			const file = await db.query.files.findFirst({
				where: (t, { eq }) => eq(t.id, fileId),
				columns: { type: true }
			});
			return dataUri(await getFile(fileId), file?.type ?? 'image/png');
		}
	} catch (error) {
		console.warn('[banners] could not read a picture:', error);
	}
	return null;
}

export interface BannerSources {
	words: BannerWords;
	look: BannerLook;
	pictures: BannerPictures;
	align: 'left' | 'center' | 'right';
}

/** Everything a banner template draws from: the profile's words, the theme's look, its pictures. */
export async function bannerSources(
	profileId: number,
	templateId: number
): Promise<{
	template: { id: number; name: string };
	config: BannerTemplateConfig;
	sources: BannerSources;
} | null> {
	const template = await db.query.presentation_templates.findFirst({
		where: and(
			eq(presentation_templates.id, templateId),
			eq(presentation_templates.profile_id, profileId),
			eq(presentation_templates.kind, 'banner')
		),
		with: {
			presentation_template_assets: { columns: { key: true, file_id: true, rendition_id: true } }
		}
	});
	if (!template) return null;
	const config = (template.config ?? {}) as BannerTemplateConfig;

	const profile = await db.query.profiles.findFirst({
		where: eq(profiles.id, profileId),
		columns: { id: true, name: true, title: true, headline: true, core_stack: true }
	});
	if (!profile) return null;

	// A version's own wording of the title or headline, where it picks one.
	const variants = await loadFieldVariants(profileId, config.versionId ?? null);
	const line = bannerLine(config.line);
	const base = line === 'headline' ? profile.headline : profile.title;
	const lineText =
		config.title?.trim() || variants.value('profile', profileId, line, base ?? '') || '';

	// The theme, published or not: a draft theme's colours are still the ones chosen.
	const theme = config.themeId
		? await db.query.presentation_templates.findFirst({
				where: and(
					eq(presentation_templates.id, config.themeId),
					eq(presentation_templates.profile_id, profileId),
					eq(presentation_templates.kind, 'portfolio')
				),
				with: {
					presentation_template_assets: {
						columns: { key: true, file_id: true, rendition_id: true }
					}
				}
			})
		: undefined;
	const themeConfig = theme
		? foldAssetsIntoConfig(
				(theme.config ?? {}) as PortfolioThemeConfig,
				theme.presentation_template_assets
			)
		: ({} as PortfolioThemeConfig);
	const scheme = config.scheme ?? (themeConfig.colorScheme === 'light' ? 'light' : 'dark');
	const palette = resolvePalette(themeConfig, scheme);

	const own = new Map(template.presentation_template_assets.map((a) => [a.key, a]));
	const themeAssets = new Map((theme?.presentation_template_assets ?? []).map((a) => [a.key, a]));
	const showLogo = config.showLogo !== false;

	return {
		template: { id: template.id, name: template.name },
		config,
		sources: {
			words: {
				name: config.name?.trim() || profile.name || '',
				line: lineText,
				tagline: config.tagline?.trim() ?? profile.core_stack ?? ''
			},
			look: {
				background: colour(palette.surface, '#0b1120'),
				text: colour(palette.highlight, '#f3f4f6'),
				accent: colour(palette.bright, '#6366f1'),
				muted: colour(palette.text, '#9ca3af'),
				headingFont: themeConfig.fonts?.heading ?? 'Poppins',
				bodyFont: themeConfig.fonts?.body ?? 'Noto Sans'
			},
			pictures: {
				logo: showLogo ? await assetPicture(own.get('logo') ?? themeAssets.get('logo')) : null,
				background: await assetPicture(own.get('background'))
			},
			align: bannerAlignment(config.align)
		}
	};
}

export interface DrawnBanner {
	presetId: number;
	preset: string;
	itemId: number;
	renditionId: string;
}

/**
 * Draw a banner template at each of its presets and file every drawing in the
 * library, each one a new version of the last drawing for that preset.
 */
export async function drawBannerTemplate(
	profileId: number,
	templateId: number
): Promise<DrawnBanner[]> {
	const loaded = await bannerSources(profileId, templateId);
	if (!loaded) throw new Error('No such banner template.');
	const { template, config, sources } = loaded;
	const presetIds = (config.presetIds ?? []).filter((id) => Number.isInteger(id));
	if (presetIds.length === 0) throw new Error('Choose at least one size to draw the banner at.');

	const presets = await db.query.media_presets.findMany({
		where: and(
			inArray(media_presets.id, presetIds),
			or(isNull(media_presets.profile_id), eq(media_presets.profile_id, profileId))
		)
	});

	const drawn: DrawnBanner[] = [];
	const context = await launchBrowser({ headless: true });
	try {
		const page = await context.newPage();
		for (const preset of presets) {
			await page.setViewportSize({ width: preset.width, height: preset.height });
			const html = bannerHtml(sources.words, sources.look, sources.pictures, {
				width: preset.width,
				height: preset.height,
				zones: Array.isArray(preset.safe_zone) ? preset.safe_zone : [],
				align: sources.align
			});
			await page.setContent(html, { waitUntil: 'networkidle', timeout: 30000 });
			await page.evaluate(() => document.fonts.ready.then(() => undefined));
			const png = await page.screenshot({
				type: 'png',
				clip: { x: 0, y: 0, width: preset.width, height: preset.height }
			});

			// The last drawing for this preset, which this one replaces.
			const previous = await db
				.select({ id: media_items.id })
				.from(media_items)
				.innerJoin(media_renditions, eq(media_renditions.item_id, media_items.id))
				.where(
					and(eq(media_items.template_id, template.id), eq(media_renditions.preset_id, preset.id))
				)
				.orderBy(desc(media_items.id))
				.limit(1);

			const item = await createMediaItem({
				profileId,
				kind: 'banner',
				label: `${template.name}: ${presetName(preset)}`,
				filename: `${template.name}-${preset.width}x${preset.height}.png`,
				bytes: Buffer.from(png),
				replacesId: previous[0]?.id ?? null,
				templateId: template.id
			});
			const renditionId = await findOrCreateRendition({
				itemId: item.id,
				presetId: preset.id,
				crop: { x: 0, y: 0, w: item.width, h: item.height },
				width: preset.width,
				height: preset.height,
				format: chooseFormat(preset.formats ?? [], false)
			});
			await ensureRendered(renditionId);
			drawn.push({ presetId: preset.id, preset: presetName(preset), itemId: item.id, renditionId });
		}
	} finally {
		await context.close();
	}
	return drawn;
}

/** Template asset rows of a banner, for its page. */
export async function bannerAssets(templateId: number) {
	return db.query.presentation_template_assets.findMany({
		where: eq(presentation_template_assets.template_id, templateId),
		columns: { key: true, file_id: true, rendition_id: true }
	});
}
