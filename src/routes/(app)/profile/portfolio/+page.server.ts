/**
 * Portfolio Site — the `portfolio` kind of `presentation_templates`.
 *
 * A third rendering of the same profile, beside Resumes & CVs: the themes here
 * dress the public profile site the way a document template dresses a printed
 * CV, and they are stored in the same table for the reasons its schema comment
 * gives.
 *
 * Publishing is two pointers on `profiles`: which version feeds the site and
 * which theme dresses it. Both null is unpublished, so there is no third
 * enable flag that can disagree with whether there is anything to serve.
 *
 * A private share link is the other way out of here and is deliberately NOT
 * duplicated on this page — `format: 'portfolio'` on Share Links mints one,
 * and it renders through the same theme, so there is one answer to "what does
 * my portfolio look like" rather than two that can drift.
 *
 * Still missing from the site itself, and worth saying because a theme lists
 * them: the reflective sections of a portfolio (ideal company, five-year
 * vision, what excites me, and the rest) have no column anywhere in the
 * profile. What publishes today is a career, not yet a portrait.
 */

import type { Actions, PageServerLoad, RequestEvent } from './$types';
import { fail, redirect, type ActionFailure } from '@sveltejs/kit';
import { dbDirect as db } from '$lib/server/db';
import {
	presentation_template_assets,
	presentation_templates,
	profiles,
	profile_versions
} from '$lib/server/db/schema';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { Buffer } from 'buffer';
import { uploadFile } from '$lib/server/files';
import { getSelectedProfileId } from '../utils';
import { getPortfolioThemesForProfile } from '$lib/server/profile/portfolio-themes';
import {
	isPortfolioSection,
	PORTFOLIO_SECTIONS,
	type PortfolioSection,
	type PortfolioThemeConfig
} from '$lib/portfolio-themes';

/** The kind every write here pins. Nothing on this page may touch a CV template. */
const KIND = 'portfolio';

/** Asset slots a theme reads, and what each accepts. */
const ASSET_SLOTS = ['logo', 'hero', 'ogImage', 'favicon', 'thumbnail'] as const;
type AssetSlot = (typeof ASSET_SLOTS)[number];

function isAssetSlot(value: string): value is AssetSlot {
	return (ASSET_SLOTS as readonly string[]).includes(value);
}

/** Image types only: every one of these slots is painted, not downloaded. */
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

const FONTS = ['Poppins', 'Carlito', 'Noto Sans'];

/** A hex colour, the only form the renderer's CSS variable can take. */
const HEX = /^#[0-9a-f]{6}$/i;

function slugify(name: string): string {
	return (
		name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/(^-|-$)/g, '') || 'theme'
	);
}

/**
 * A slug no other theme of this profile holds.
 *
 * (profile, kind, slug) is unique, so the insert would otherwise fail on a
 * second theme called "Dark" — which is a name someone may reasonably want
 * twice while they are trying things out.
 */
async function freeSlug(profileId: number, wanted: string, exceptId?: number): Promise<string> {
	const rows = await db.query.presentation_templates.findMany({
		where: and(
			eq(presentation_templates.profile_id, profileId),
			eq(presentation_templates.kind, KIND)
		),
		columns: { id: true, slug: true }
	});
	const taken = new Set(rows.filter((r) => r.id !== exceptId).map((r) => r.slug));
	let slug = wanted;
	for (let n = 2; taken.has(slug); n++) slug = `${wanted}-${n}`;
	return slug;
}

/**
 * Whether this theme is this profile's.
 *
 * Every action takes the theme id from the form, so every action has to ask.
 * `isPortfolioThemeOwned` would answer the same question; this returns the row
 * because the write paths want the current config too, and asking twice is a
 * round trip for nothing.
 */
async function ownedTheme(profileId: number, themeId: number) {
	return db.query.presentation_templates.findFirst({
		where: and(
			eq(presentation_templates.id, themeId),
			eq(presentation_templates.kind, KIND),
			eq(presentation_templates.profile_id, profileId)
		)
	});
}

/**
 * The profile every action writes to.
 *
 * Actions do not get `parent`, so the selected profile comes from the cookie
 * the same way the other profile pages resolve it — and `getSelectedProfileId`
 * checks the cookie's profile against the caller before returning it, which is
 * the ownership check these writes rest on.
 */
async function selectedProfile(
	event: RequestEvent
): Promise<number | ActionFailure<{ error: string }>> {
	const user = event.locals.user;
	if (!user) return fail(401, { error: 'Not authenticated' });
	const profileId = await getSelectedProfileId(event.cookies, user.id);
	if (!profileId) return fail(400, { error: 'No profile selected' });
	return profileId;
}

export const load: PageServerLoad = async ({ parent }) => {
	const layoutData = await parent();
	if (!layoutData.selectedProfile) redirect(302, '/home');

	const profileId = layoutData.selectedProfile.id;

	const [themes, versions, published] = await Promise.all([
		getPortfolioThemesForProfile(profileId),
		// Library versions only, as on Share Links: a version owned by an
		// application is that application's working copy, not something to
		// publish to the world.
		db.query.profile_versions.findMany({
			where: and(
				eq(profile_versions.profile_id, profileId),
				isNull(profile_versions.application_id)
			),
			columns: { id: true, name: true, slug: true },
			orderBy: asc(profile_versions.name)
		}),
		db.query.profiles.findFirst({
			where: eq(profiles.id, profileId),
			columns: { public_portfolio_version_id: true, public_portfolio_theme_id: true }
		})
	]);

	return {
		themes,
		versions,
		sections: PORTFOLIO_SECTIONS,
		fonts: FONTS,
		profileSlug: layoutData.selectedProfile.slug,
		publishedVersionId: published?.public_portfolio_version_id ?? null,
		publishedThemeId: published?.public_portfolio_theme_id ?? null
	};
};

export const actions: Actions = {
	create: async (event) => {
		const profileId = await selectedProfile(event);
		if (typeof profileId !== 'number') return profileId;
		const { request } = event;
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'A theme needs a name.' });

		const now = new Date();
		await db.insert(presentation_templates).values({
			profile_id: profileId,
			kind: KIND,
			name,
			slug: await freeSlug(profileId, slugify(name)),
			status: 'published',
			// Last in the list; `sort` nulls sort first, so a new theme without one
			// would jump to the front of a list the applicant has ordered.
			sort: await nextSort(profileId),
			config: {},
			date_created: now,
			date_updated: now
		});

		return { created: true };
	},

	rename: async (event) => {
		const profileId = await selectedProfile(event);
		if (typeof profileId !== 'number') return profileId;
		const { request } = event;
		const form = await request.formData();
		const themeId = Number(form.get('themeId'));
		const name = String(form.get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'A theme needs a name.' });

		const theme = await ownedTheme(profileId, themeId);
		if (!theme) return fail(404, { error: 'No such theme.' });

		await db
			.update(presentation_templates)
			.set({ name, date_updated: new Date() })
			.where(eq(presentation_templates.id, themeId));

		return { renamed: true };
	},

	/**
	 * Write the design fields back.
	 *
	 * The config is rebuilt from the stored one rather than replaced, because
	 * `assets` and `thumbnail` live in it too — they are folded in from the
	 * asset rows on read, and a whole-object write would persist that fold back
	 * into the jsonb and undo the normalization those rows exist for.
	 */
	design: async (event) => {
		const profileId = await selectedProfile(event);
		if (typeof profileId !== 'number') return profileId;
		const { request } = event;
		const form = await request.formData();
		const themeId = Number(form.get('themeId'));

		const theme = await ownedTheme(profileId, themeId);
		if (!theme) return fail(404, { error: 'No such theme.' });

		const accent = String(form.get('accent') ?? '').trim();
		if (accent && !HEX.test(accent)) {
			return fail(400, { error: 'Accent must be a hex colour like #ff8800.' });
		}

		const heading = String(form.get('headingFont') ?? '');
		const body = String(form.get('bodyFont') ?? '');
		const scheme = String(form.get('colorScheme') ?? '');

		const chosen = form
			.getAll('sections')
			.map(String)
			.filter(isPortfolioSection) as PortfolioSection[];
		const order = form.getAll('order').map(String).filter(isPortfolioSection) as PortfolioSection[];
		// The checkboxes say which sections; the hidden order field says in what
		// sequence. Intersecting them keeps one source for each question.
		const sections = order.filter((s) => chosen.includes(s));

		const stored = (theme.config ?? {}) as PortfolioThemeConfig;
		const next: PortfolioThemeConfig = { ...stored };

		if (accent) next.accent = accent;
		else delete next.accent;

		const fonts: PortfolioThemeConfig['fonts'] = {};
		if (FONTS.includes(heading)) fonts.heading = heading as never;
		if (FONTS.includes(body)) fonts.body = body as never;
		if (Object.keys(fonts).length > 0) next.fonts = fonts;
		else delete next.fonts;

		if (scheme === 'light' || scheme === 'dark') next.colorScheme = scheme;
		else delete next.colorScheme;

		// Absent means "every section in the default order"; storing the full
		// list instead would freeze today's vocabulary into the row and hide a
		// section added later from every existing theme.
		const isDefault =
			sections.length === PORTFOLIO_SECTIONS.length &&
			sections.every((s, i) => s === PORTFOLIO_SECTIONS[i]);
		if (isDefault) delete next.sections;
		else next.sections = sections;

		await db
			.update(presentation_templates)
			.set({ config: next, date_updated: new Date() })
			.where(eq(presentation_templates.id, themeId));

		return { saved: true };
	},

	/**
	 * Put an image in one slot.
	 *
	 * The row is upserted on (template_id, key), so replacing a logo leaves the
	 * previous file with nothing pointing at it. That file is not deleted here:
	 * a blob may be referenced from more than one place, and deciding it is
	 * unreachable is the orphan reaper's job — it can see these rows now that
	 * they carry a foreign key, which is the whole reason the table exists.
	 */
	uploadAsset: async (event) => {
		const profileId = await selectedProfile(event);
		if (typeof profileId !== 'number') return profileId;
		const { request } = event;
		const form = await request.formData();
		const themeId = Number(form.get('themeId'));
		const slot = String(form.get('slot') ?? '');

		if (!isAssetSlot(slot)) return fail(400, { error: 'Unknown image slot.' });

		const theme = await ownedTheme(profileId, themeId);
		if (!theme) return fail(404, { error: 'No such theme.' });

		const file = form.get('file');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { error: 'Choose an image to upload.' });
		}
		const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
		if (!IMAGE_EXTENSIONS.includes(ext)) {
			return fail(400, { error: `Images only (${IMAGE_EXTENSIONS.join(', ')}).` });
		}

		const stored = await uploadFile({
			filename: file.name,
			buffer: Buffer.from(await file.arrayBuffer()),
			title: `${theme.name} ${slot}`
		});

		await db
			.insert(presentation_template_assets)
			.values({
				template_id: themeId,
				key: slot,
				file_id: stored.id,
				date_created: new Date()
			})
			.onConflictDoUpdate({
				target: [presentation_template_assets.template_id, presentation_template_assets.key],
				set: { file_id: stored.id, date_created: new Date() }
			});

		return { uploaded: slot };
	},

	removeAsset: async (event) => {
		const profileId = await selectedProfile(event);
		if (typeof profileId !== 'number') return profileId;
		const { request } = event;
		const form = await request.formData();
		const themeId = Number(form.get('themeId'));
		const slot = String(form.get('slot') ?? '');

		if (!isAssetSlot(slot)) return fail(400, { error: 'Unknown image slot.' });

		const theme = await ownedTheme(profileId, themeId);
		if (!theme) return fail(404, { error: 'No such theme.' });

		await db
			.delete(presentation_template_assets)
			.where(
				and(
					eq(presentation_template_assets.template_id, themeId),
					eq(presentation_template_assets.key, slot)
				)
			);

		return { removed: slot };
	},

	/**
	 * Publish, or change what is published.
	 *
	 * Both pointers are written together because either alone is a site that
	 * cannot render: a version with no theme has nothing to dress it, a theme
	 * with no version has nothing to show. Writing them in one statement means
	 * there is no moment where the public URL serves half a decision.
	 */
	publish: async (event) => {
		const profileId = await selectedProfile(event);
		if (typeof profileId !== 'number') return profileId;
		const form = await event.request.formData();

		const themeId = Number(form.get('themeId'));
		const versionId = Number(form.get('versionId'));

		const theme = await ownedTheme(profileId, themeId);
		if (!theme) return fail(404, { error: 'No such theme.' });
		if (theme.status !== 'published') {
			return fail(400, { error: 'That theme is a draft. Only a published theme can go live.' });
		}

		// The version has to be this profile's too, and a library one: the
		// version id arrives from the form like the theme id does.
		const version = await db.query.profile_versions.findFirst({
			where: and(
				eq(profile_versions.id, versionId),
				eq(profile_versions.profile_id, profileId),
				isNull(profile_versions.application_id)
			),
			columns: { id: true }
		});
		if (!version) return fail(400, { error: 'Choose a version to publish.' });

		await db
			.update(profiles)
			.set({
				public_portfolio_theme_id: themeId,
				public_portfolio_version_id: versionId,
				date_updated: new Date()
			})
			.where(eq(profiles.id, profileId));

		return { published: true };
	},

	/** Take the site down. Both pointers together, for the reason publish sets both. */
	unpublish: async (event) => {
		const profileId = await selectedProfile(event);
		if (typeof profileId !== 'number') return profileId;

		await db
			.update(profiles)
			.set({
				public_portfolio_theme_id: null,
				public_portfolio_version_id: null,
				date_updated: new Date()
			})
			.where(eq(profiles.id, profileId));

		return { unpublished: true };
	},

	delete: async (event) => {
		const profileId = await selectedProfile(event);
		if (typeof profileId !== 'number') return profileId;
		const { request } = event;
		const form = await request.formData();
		const themeId = Number(form.get('themeId'));

		const theme = await ownedTheme(profileId, themeId);
		if (!theme) return fail(404, { error: 'No such theme.' });

		const published = await db.query.profiles.findFirst({
			where: eq(profiles.id, profileId),
			columns: { public_portfolio_theme_id: true }
		});

		// The asset rows go with it by cascade; their files are left to the
		// reaper for the reason uploadAsset gives. The theme pointer on
		// `profiles` is ON DELETE SET NULL, so the site goes dark on its own —
		// but the VERSION pointer is not, and a version with no theme is a
		// published site with nothing to dress it. Clear both, so "published"
		// stays the single fact that both pointers are set.
		if (published?.public_portfolio_theme_id === themeId) {
			await db
				.update(profiles)
				.set({ public_portfolio_theme_id: null, public_portfolio_version_id: null })
				.where(eq(profiles.id, profileId));
		}

		await db.delete(presentation_templates).where(eq(presentation_templates.id, themeId));

		return { deleted: true };
	}
};

/**
 * One past the highest `sort` this profile's themes hold.
 *
 * No `orderBy`: one aggregate row comes back, and ordering it by a column that
 * is not grouped is a 42803 from Postgres rather than a no-op.
 */
async function nextSort(profileId: number): Promise<number> {
	const [row] = await db
		.select({ max: sql<number | null>`max(${presentation_templates.sort})` })
		.from(presentation_templates)
		.where(
			and(eq(presentation_templates.profile_id, profileId), eq(presentation_templates.kind, KIND))
		);
	return (row?.max ?? -1) + 1;
}
