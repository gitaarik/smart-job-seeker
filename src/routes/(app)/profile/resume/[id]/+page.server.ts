import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { dbDirect as db, queryRaw, sql } from '$lib/server/db';
import {
	profile_versions,
	profile_version_extensions,
	profiles,
	applications
} from '$lib/server/db/schema';
import { eq, and, ne, or, asc, isNull } from 'drizzle-orm';
import { getSelectedProfileId } from '../../utils';
import { generateVersionPdfs } from '$lib/server/profile/generate-version-pdfs';
import { retagVersionSlug } from '$lib/server/profile/tailor-version';
import { chargeCredits } from '$lib/server/billing/credits';
import { requireCredits } from '$lib/server/billing/require-credits';
import { buildToggles } from '$lib/resume-contact-fields';
import { isTailoredSlug } from '$lib/version-overrides';
import { listFieldVariants, pickedVariantIds } from '$lib/server/profile/field-variants';
import { VARIANT_FIELDS } from '$lib/field-variants';

export const load: PageServerLoad = async ({ params, parent }) => {
	const layoutData = await parent();

	if (!layoutData.selectedProfile) {
		redirect(302, '/home');
	}

	const id = parseInt(params.id);
	if (isNaN(id)) {
		redirect(302, '/profile/resume');
	}

	const version = await db.query.profile_versions.findFirst({
		where: and(
			eq(profile_versions.id, id),
			eq(profile_versions.profile_id, layoutData.selectedProfile.id)
		),
		with: {
			extension_links: {
				columns: {
					extended_id: true
				}
			}
		}
	});

	if (!version) {
		redirect(302, '/profile/resume');
	}

	const { extension_links: exts, ...v } = version;

	const profile = await db.query.profiles.findFirst({
		where: eq(profiles.id, layoutData.selectedProfile.id),
		columns: {
			public_resume_version_id: true,
			public_cv_version_id: true,
			// The default wording of each field a variant can stand in for — the
			// "your own summary" option in the picker below.
			title: true,
			subtitle: true,
			headline: true,
			summary: true
		}
	});

	// Get all other versions for "extends" options
	// Extending a library version is how a tailored version reuses curation;
	// extending somebody's per-job copy is not a thing to offer.
	const allVersions = await db.query.profile_versions.findMany({
		where: and(
			eq(profile_versions.profile_id, layoutData.selectedProfile.id),
			ne(profile_versions.id, id),
			isNull(profile_versions.application_id)
		),
		orderBy: asc(profile_versions.name),
		columns: { id: true, name: true, slug: true }
	});

	// Find entities that reference this version's slug in their tags
	const slug = v.slug;
	type TaggedRow = { id: number; name: string | null };
	type TaggedAchievementRow = { id: number; name: string | null; work_experience_id: number };
	let taggedWorkExperiences: TaggedRow[] = [];
	let taggedEducation: TaggedRow[] = [];
	let taggedSideProjects: TaggedRow[] = [];
	let taggedSkills: TaggedRow[] = [];
	let taggedAchievements: TaggedAchievementRow[] = [];

	if (slug) {
		const profileId = layoutData.selectedProfile.id;
		const tagJson = JSON.stringify([slug]);

		[taggedWorkExperiences, taggedEducation, taggedSideProjects, taggedSkills, taggedAchievements] =
			await Promise.all([
				queryRaw<TaggedRow>(sql`
          SELECT id, COALESCE(position, name) as name FROM work_experiences
          WHERE profile_id = ${profileId} AND tags::jsonb @> ${tagJson}::jsonb
          ORDER BY name ASC`),
				queryRaw<TaggedRow>(sql`
          SELECT id, COALESCE(institution, area) as name FROM education
          WHERE profile_id = ${profileId} AND tags::jsonb @> ${tagJson}::jsonb
          ORDER BY name ASC`),
				queryRaw<TaggedRow>(sql`
          SELECT id, name FROM side_projects
          WHERE profile_id = ${profileId} AND tags::jsonb @> ${tagJson}::jsonb
          ORDER BY name ASC`),
				queryRaw<TaggedRow>(sql`
          SELECT ts.id, ts.name FROM tech_skills ts
          JOIN tech_skill_categories tsc ON ts.category_id = tsc.id
          WHERE tsc.profile_id = ${profileId} AND ts.tags::jsonb @> ${tagJson}::jsonb
          ORDER BY ts.name ASC`),
				queryRaw<TaggedAchievementRow>(sql`
          SELECT wea.id, wea.description as name, wea.work_experience_id FROM work_experience_achievements wea
          JOIN work_experiences we ON wea.work_experience_id = we.id
          WHERE we.profile_id = ${profileId} AND wea.tags::jsonb @> ${tagJson}::jsonb
          ORDER BY wea.description ASC`)
			]);
	}

	// Alternative wordings, and which this version picked. Loaded here rather
	// than fetched by the component so the picker renders with the version
	// instead of flickering through "no alternatives" on every page load.
	const [fieldVariants, pickedIds] = await Promise.all([
		listFieldVariants(layoutData.selectedProfile.id),
		pickedVariantIds(id)
	]);
	// pickedIds is newest-first, so the first match per field is the pick that
	// stands — the same rule the render resolver applies. See field-variants.ts.
	const wordingPicks: Record<string, number | null> = {};
	for (const f of VARIANT_FIELDS) {
		wordingPicks[f.field] =
			pickedIds.find((picked) =>
				fieldVariants.some((v) => v.id === picked && v.field === f.field)
			) ?? null;
	}

	return {
		version: {
			...v,
			extendsIds: exts?.map((e) => e.extended_id).filter((id): id is number => id !== null) ?? []
		},
		fieldVariants,
		wordingPicks,
		wordingDefaults: {
			title: profile?.title ?? '',
			subtitle: profile?.subtitle ?? '',
			headline: profile?.headline ?? '',
			summary: profile?.summary ?? ''
		},
		allVersions,
		publicResumeVersionId: profile?.public_resume_version_id ?? null,
		publicCvVersionId: profile?.public_cv_version_id ?? null,
		tagUsage: {
			workExperiences: taggedWorkExperiences,
			education: taggedEducation,
			sideProjects: taggedSideProjects,
			skills: taggedSkills,
			achievements: taggedAchievements
		}
	};
};

export const actions: Actions = {
	update: async ({ request, locals, cookies, params }) => {
		const user = locals.user;
		if (!user) {
			return fail(401, { error: 'Not authenticated' });
		}

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) {
			return fail(400, { error: 'No profile selected' });
		}

		const id = parseInt(params.id);
		if (isNaN(id)) {
			return fail(400, { error: 'Invalid version ID' });
		}

		const formData = await request.formData();
		const slug = formData.get('slug') as string;
		const name = formData.get('name') as string;
		const extendsIds = formData
			.getAll('extendsIds')
			.map((v) => parseInt(v as string))
			.filter((v) => !isNaN(v) && v !== id);
		const setPublicResume = formData.get('publicResume') === 'on';
		const setPublicCv = formData.get('publicCv') === 'on';

		if (!slug || slug.trim().length === 0) {
			return fail(400, { error: 'Slug is required' });
		}

		const existing = await db.query.profile_versions.findFirst({
			where: and(eq(profile_versions.id, id), eq(profile_versions.profile_id, profileId))
		});

		if (!existing) {
			return fail(404, { error: 'Version not found' });
		}

		// The `app-<id>` namespace belongs to job-tailored versions; a hand-made
		// version sharing a slug with one would surface as the wrong document being
		// sent, not as an error. A tailored version editing itself keeps its own
		// slug, so the guard is about a LIBRARY version claiming the namespace.
		if (isTailoredSlug(slug) && existing.application_id === null) {
			return fail(400, {
				error: 'Slugs starting with "app-<number>" are reserved for job-tailored versions.'
			});
		}

		const newSlug = slug.trim();
		// Nullable: a version can exist without a slug, and giving it one for the
		// first time is a change that has to be checked like any other — it just
		// has no references behind it to carry.
		const oldSlug = existing.slug;
		const slugChanged = oldSlug !== newSlug;

		// The column has no unique constraint — uniqueness is a rule this app
		// keeps, the same way `uniqueLibrarySlug` keeps it when promoting. It
		// matters more here than at creation: a slug is how item tags and
		// `applications.cv_version_sent` name a version, so renaming onto a slug
		// already in use would not merely be ambiguous, it would hand this
		// version every item tagged onto the other one.
		if (slugChanged) {
			const clash = await db.query.profile_versions.findFirst({
				where: and(
					eq(profile_versions.profile_id, profileId),
					eq(profile_versions.slug, newSlug),
					ne(profile_versions.id, id)
				),
				columns: { id: true }
			});
			if (clash) {
				return fail(400, { error: `Another version already uses the slug "${newSlug}".` });
			}
		}

		// Contact visibility: the form submits one `contactVisible` value per field
		// left checked. buildToggles() turns the rest into `hide:<key>` tokens and
		// preserves any non-contact toggles (e.g. "nationality") already stored.
		const visibleContacts = formData.getAll('contactVisible').map(String);
		const toggles = buildToggles(visibleContacts, existing.toggles);

		await db
			.update(profile_versions)
			.set({
				slug: newSlug,
				name: name?.trim() || null,
				toggles,
				date_updated: new Date()
			})
			.where(eq(profile_versions.id, id));

		// A slug is a reference, not a label. Two things name this version by slug
		// rather than by id, and neither cascades: the record of which document an
		// application sent, and the `tags` array on every profile item. Renaming
		// without carrying them broke both silently — the sent-record started
		// pointing at nothing, and a skill somebody had added to this version
		// stopped printing on it while its tag still sat there looking right.
		//
		// `promoteToLibrary` has done exactly this since tailored versions shipped;
		// the library editor is the path that was missed.
		if (slugChanged && oldSlug) {
			await db
				.update(applications)
				.set({ cv_version_sent: newSlug, date_updated: new Date() })
				.where(
					and(eq(applications.profile_id, profileId), eq(applications.cv_version_sent, oldSlug))
				);

			await retagVersionSlug(profileId, oldSlug, newSlug);
		}

		// Update public resume/cv version on profile
		const profile = await db.query.profiles.findFirst({
			where: eq(profiles.id, profileId),
			columns: { public_resume_version_id: true, public_cv_version_id: true }
		});

		const profileUpdate: {
			public_resume_version_id?: number | null;
			public_cv_version_id?: number | null;
		} = {};

		if (setPublicResume) {
			if (profile?.public_resume_version_id !== id) {
				profileUpdate.public_resume_version_id = id;
			}
		} else if (profile?.public_resume_version_id === id) {
			profileUpdate.public_resume_version_id = null;
		}

		if (setPublicCv) {
			if (profile?.public_cv_version_id !== id) {
				profileUpdate.public_cv_version_id = id;
			}
		} else if (profile?.public_cv_version_id === id) {
			profileUpdate.public_cv_version_id = null;
		}

		if (Object.keys(profileUpdate).length > 0) {
			await db.update(profiles).set(profileUpdate).where(eq(profiles.id, profileId));
		}

		// Update extensions: remove old, add new ones
		await db
			.delete(profile_version_extensions)
			.where(eq(profile_version_extensions.extender_id, id));

		for (const parentId of extendsIds) {
			const parent = await db.query.profile_versions.findFirst({
				where: and(eq(profile_versions.id, parentId), eq(profile_versions.profile_id, profileId))
			});
			if (parent) {
				await db.insert(profile_version_extensions).values({
					extender_id: id,
					extended_id: parentId
				});
			}
		}

		await requireCredits(user.id, 1);
		await chargeCredits(user.id, 1, 'pdf_export', 'PDF export');
		generateVersionPdfs(profileId, newSlug).catch(console.error);

		return { success: true };
	},

	delete: async ({ request, locals, cookies, params }) => {
		const user = locals.user;
		if (!user) {
			return fail(401, { error: 'Not authenticated' });
		}

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) {
			return fail(400, { error: 'No profile selected' });
		}

		const id = parseInt(params.id);
		if (isNaN(id)) {
			return fail(400, { error: 'Invalid version ID' });
		}

		const existing = await db.query.profile_versions.findFirst({
			where: and(eq(profile_versions.id, id), eq(profile_versions.profile_id, profileId))
		});

		if (!existing) {
			return fail(404, { error: 'Version not found' });
		}

		// Clear public version references if this version was public
		const profile = await db.query.profiles.findFirst({
			where: eq(profiles.id, profileId),
			columns: { public_resume_version_id: true, public_cv_version_id: true }
		});

		const profileUpdate: {
			public_resume_version_id?: number | null;
			public_cv_version_id?: number | null;
		} = {};

		if (profile?.public_resume_version_id === id) {
			profileUpdate.public_resume_version_id = null;
		}
		if (profile?.public_cv_version_id === id) {
			profileUpdate.public_cv_version_id = null;
		}

		if (Object.keys(profileUpdate).length > 0) {
			await db.update(profiles).set(profileUpdate).where(eq(profiles.id, profileId));
		}

		// Remove extension records where this version is extender or extended
		await db
			.delete(profile_version_extensions)
			.where(
				or(
					eq(profile_version_extensions.extender_id, id),
					eq(profile_version_extensions.extended_id, id)
				)
			);

		await db.delete(profile_versions).where(eq(profile_versions.id, id));

		// Overrides cascade with the row; tags naming its slug do not. Left behind
		// they are invisible — the item still carries a tag that still looks right
		// — and the slug is not retired with the version: nothing stops a later
		// version from being created under the same one, which would silently
		// inherit every item tagged onto this one.
		if (existing.slug) await retagVersionSlug(profileId, existing.slug, null);

		// `applications.cv_version_sent` is deliberately NOT cleared here, which is
		// the opposite of what discarding a tailored version does. That one is a
		// draft belonging to a single application, and deleting it means it was
		// never sent. This is a library document that may have been sent to any
		// number of applications, and "I sent my frontend resume" stays true after
		// the version is deleted — nulling it would erase a real record for every
		// one of them. The application page degrades on its own: the name resolves
		// to null and it reads "Resume sent", which is still what happened.

		redirect(302, '/profile/resume');
	}
};
