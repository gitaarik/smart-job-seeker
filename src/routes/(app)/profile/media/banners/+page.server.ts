/**
 * Banner templates: banners drawn from the profile, at every size a platform
 * asks for (planning/MEDIA-LIBRARY.md, decision 6; `$lib/banner-templates.ts`).
 *
 * The words come from the profile (or a resume version's wording of the
 * title), the colours and fonts from a portfolio theme. "Draw" photographs the
 * layout at each chosen preset and files each drawing in the media library, as
 * a new version of the last one.
 */

import type { Actions, PageServerLoad } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import {
	media_items,
	media_renditions,
	presentation_templates,
	profile_versions
} from '$lib/server/db/schema';
import { getSelectedProfileId } from '../../utils';
import { listPresets } from '$lib/server/media/presets';
import { bannerHtml, bannerSources, drawBannerTemplate } from '$lib/server/media/banners';
import { assignTemplateSlot, clearThemeSlot, SlotError } from '$lib/server/media/slots';
import { foldAssetsIntoConfig } from '$lib/server/profile/presentation-templates';
import { bannerAlignment, bannerLine, type BannerTemplateConfig } from '$lib/banner-templates';
import { BANNER_MEDIA_SLOTS, isBannerMediaSlot, type Crop } from '$lib/media-library';

const KIND = 'banner';

export const load: PageServerLoad = async ({ parent, url }) => {
	const layoutData = await parent();
	if (!layoutData.selectedProfile) redirect(302, '/home');
	const profileId = layoutData.selectedProfile.id;

	const [rows, themes, versions, presets] = await Promise.all([
		db.query.presentation_templates.findMany({
			where: and(
				eq(presentation_templates.profile_id, profileId),
				eq(presentation_templates.kind, KIND)
			),
			orderBy: [asc(presentation_templates.sort), asc(presentation_templates.id)],
			with: {
				presentation_template_assets: { columns: { key: true, file_id: true, rendition_id: true } }
			}
		}),
		db.query.presentation_templates.findMany({
			where: and(
				eq(presentation_templates.profile_id, profileId),
				eq(presentation_templates.kind, 'portfolio')
			),
			columns: { id: true, name: true },
			orderBy: asc(presentation_templates.name)
		}),
		db.query.profile_versions.findMany({
			where: and(
				eq(profile_versions.profile_id, profileId),
				isNull(profile_versions.application_id)
			),
			columns: { id: true, name: true, slug: true },
			orderBy: asc(profile_versions.name)
		}),
		listPresets(profileId)
	]);

	const banners = [];
	for (const row of rows) {
		const config = (row.config ?? {}) as BannerTemplateConfig;
		const loaded = await bannerSources(profileId, row.id);
		const firstPreset = presets.find((p) => (config.presetIds ?? []).includes(p.id)) ?? null;
		const preview =
			loaded && firstPreset
				? {
						width: firstPreset.width,
						height: firstPreset.height,
						html: bannerHtml(loaded.sources.words, loaded.sources.look, loaded.sources.pictures, {
							width: firstPreset.width,
							height: firstPreset.height,
							zones: firstPreset.safeZone,
							align: loaded.sources.align,
							baseUrl: url.origin
						})
					}
				: null;
		// The newest drawing per preset.
		const drawings = await db
			.select({
				itemId: media_items.id,
				renditionId: media_renditions.id,
				presetId: media_renditions.preset_id,
				date: media_items.date_created
			})
			.from(media_items)
			.innerJoin(media_renditions, eq(media_renditions.item_id, media_items.id))
			.where(and(eq(media_items.template_id, row.id), eq(media_items.profile_id, profileId)))
			.orderBy(desc(media_items.id));
		const newest = new Map<number, (typeof drawings)[number]>();
		for (const d of drawings) if (d.presetId && !newest.has(d.presetId)) newest.set(d.presetId, d);

		banners.push({
			id: row.id,
			name: row.name,
			config: {
				themeId: config.themeId ?? null,
				scheme: config.scheme ?? null,
				versionId: config.versionId ?? null,
				line: bannerLine(config.line),
				name: config.name ?? '',
				title: config.title ?? '',
				tagline: config.tagline ?? null,
				align: bannerAlignment(config.align),
				showLogo: config.showLogo !== false,
				presetIds: config.presetIds ?? []
			},
			assets:
				foldAssetsIntoConfig(
					{} as { assets?: Record<string, string> },
					row.presentation_template_assets
				).assets ?? {},
			preview,
			drawings: [...newest.values()].map((d) => ({
				itemId: d.itemId,
				renditionId: d.renditionId,
				presetId: d.presetId,
				date: d.date?.toISOString() ?? null
			}))
		});
	}

	return { banners, themes, versions, presets };
};

async function profileFor(event: Parameters<Actions[string]>[0]) {
	const user = event.locals.user;
	if (!user) redirect(302, '/login');
	const profileId = await getSelectedProfileId(event.cookies, user.id);
	if (!profileId) error(400, 'Choose a profile first.');
	return profileId;
}

async function ownedBanner(profileId: number, id: number) {
	return db.query.presentation_templates.findFirst({
		where: and(
			eq(presentation_templates.id, id),
			eq(presentation_templates.profile_id, profileId),
			eq(presentation_templates.kind, KIND)
		)
	});
}

/** A crop from a form field, as JSON; null when absent or not one. Clamped where it is used. */
function parseCrop(raw: FormDataEntryValue | null): Crop | null {
	if (typeof raw !== 'string' || !raw) return null;
	try {
		const { x, y, w, h } = JSON.parse(raw) as Record<string, unknown>;
		return [x, y, w, h].every((n) => typeof n === 'number' && Number.isFinite(n))
			? ({ x, y, w, h } as Crop)
			: null;
	} catch {
		return null;
	}
}

function slugify(name: string): string {
	return (
		name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/(^-|-$)/g, '') || 'banner'
	);
}

export const actions: Actions = {
	create: async (event) => {
		const profileId = await profileFor(event);
		const form = await event.request.formData();
		const name = String(form.get('name') ?? '').trim() || 'Banner';
		const taken = new Set(
			(
				await db.query.presentation_templates.findMany({
					where: and(
						eq(presentation_templates.profile_id, profileId),
						eq(presentation_templates.kind, KIND)
					),
					columns: { slug: true }
				})
			).map((r) => r.slug)
		);
		let slug = slugify(name);
		for (let n = 2; taken.has(slug); n++) slug = `${slugify(name)}-${n}`;
		// Starts at the two banner sizes everyone has: LinkedIn's and X's.
		const presets = await listPresets(profileId);
		const presetIds = presets
			.filter((p) => p.key === 'linkedin-background' || p.key === 'x-header')
			.map((p) => p.id);
		const config: BannerTemplateConfig = {
			align: 'right',
			line: 'title',
			showLogo: true,
			presetIds
		};
		await db.insert(presentation_templates).values({
			profile_id: profileId,
			kind: KIND,
			name: name.slice(0, 255),
			slug,
			status: 'draft',
			config,
			date_created: new Date(),
			date_updated: new Date()
		});
		return { created: true };
	},

	save: async (event) => {
		const profileId = await profileFor(event);
		const form = await event.request.formData();
		const banner = await ownedBanner(profileId, Number(form.get('id')));
		if (!banner) return fail(404, { error: 'No such banner.' });
		const text = (name: string) => String(form.get(name) ?? '').trim();
		const themeId = Number(text('themeId')) || null;
		const versionId = Number(text('versionId')) || null;
		const scheme = text('scheme');
		const config: BannerTemplateConfig = {
			themeId,
			versionId,
			scheme: scheme === 'light' || scheme === 'dark' ? scheme : undefined,
			line: bannerLine(text('line')),
			name: text('name') || null,
			title: text('title') || null,
			// Empty means "no tagline"; absent means the profile's core stack.
			tagline: form.has('useStack') ? null : text('tagline'),
			align: bannerAlignment(text('align')),
			showLogo: form.has('showLogo'),
			presetIds: form
				.getAll('presetIds')
				.map(Number)
				.filter((id) => Number.isInteger(id) && id > 0)
		};
		const name = text('bannerName') || banner.name;
		await db
			.update(presentation_templates)
			.set({ config, name: name.slice(0, 255), date_updated: new Date() })
			.where(eq(presentation_templates.id, banner.id));
		return { saved: banner.id };
	},

	delete: async (event) => {
		const profileId = await profileFor(event);
		const form = await event.request.formData();
		const banner = await ownedBanner(profileId, Number(form.get('id')));
		if (!banner) return fail(404, { error: 'No such banner.' });
		// Its drawings stay in the library (their template link clears itself).
		await db.delete(presentation_templates).where(eq(presentation_templates.id, banner.id));
		return { deleted: true };
	},

	pickAsset: async (event) => {
		const profileId = await profileFor(event);
		const form = await event.request.formData();
		const banner = await ownedBanner(profileId, Number(form.get('id')));
		const key = String(form.get('slot') ?? '');
		if (!banner || !isBannerMediaSlot(key)) return fail(400, { error: 'Unknown slot.' });
		const crop = parseCrop(form.get('crop'));
		try {
			await assignTemplateSlot(
				banner.id,
				profileId,
				key,
				BANNER_MEDIA_SLOTS[key],
				Number(form.get('itemId')),
				crop
			);
		} catch (err) {
			if (err instanceof SlotError) return fail(err.status, { error: err.message });
			throw err;
		}
		return { picked: key };
	},

	removeAsset: async (event) => {
		const profileId = await profileFor(event);
		const form = await event.request.formData();
		const banner = await ownedBanner(profileId, Number(form.get('id')));
		const key = String(form.get('slot') ?? '');
		if (!banner || !isBannerMediaSlot(key)) return fail(400, { error: 'Unknown slot.' });
		await clearThemeSlot(banner.id, key);
		return { removed: key };
	},

	draw: async (event) => {
		const profileId = await profileFor(event);
		const form = await event.request.formData();
		const banner = await ownedBanner(profileId, Number(form.get('id')));
		if (!banner) return fail(404, { error: 'No such banner.' });
		try {
			const drawn = await drawBannerTemplate(profileId, banner.id);
			return { drawn: drawn.length, bannerId: banner.id };
		} catch (err) {
			return fail(400, {
				error: err instanceof Error ? err.message : 'Could not draw the banner.'
			});
		}
	}
};
