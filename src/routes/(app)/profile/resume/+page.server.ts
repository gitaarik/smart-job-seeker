import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { dbDirect as db } from '$lib/server/db';
import {
	profiles,
	profile_versions,
	profile_version_extensions,
	profile_exports,
	profile_translations
} from '$lib/server/db/schema';
import { eq, and, asc, inArray } from 'drizzle-orm';
import { getSelectedProfileId } from '../utils';
import { generateVersionPdfs } from '$lib/server/profile/generate-version-pdfs';
import { chargeCredits } from '$lib/server/billing/credits';
import { requireCredits } from '$lib/server/billing/require-credits';
import { DEFAULT_TEMPLATE_ID, templateForStorage } from '$lib/resume-templates';
import { getResumeTemplatesForProfile } from '$lib/server/profile/resume-templates';
import { BASE_LOCALE, isKnownLocale, LOCALES } from '$lib/resume-translations';

export const load: PageServerLoad = async ({ parent, url }) => {
	const layoutData = await parent();

	if (!layoutData.selectedProfile) {
		redirect(302, '/home');
	}

	const [profile, versions, profileExports, templates, translatedLocaleRows] = await Promise.all([
		db.query.profiles.findFirst({
			where: eq(profiles.id, layoutData.selectedProfile.id),
			columns: {
				public_resume_version_id: true,
				public_cv_version_id: true
			}
		}),
		db.query.profile_versions.findMany({
			where: eq(profile_versions.profile_id, layoutData.selectedProfile.id),
			with: {
				extension_links: {
					columns: {
						extended_id: true
					}
				}
			},
			orderBy: asc(profile_versions.name)
		}),
		db.query.profile_exports.findMany({
			where: and(
				eq(profile_exports.profile_id, layoutData.selectedProfile.id),
				eq(profile_exports.status, 'published'),
				inArray(profile_exports.export_type, ['resume', 'cv'])
			),
			columns: {
				description: true,
				export_type: true,
				export_format: true,
				template: true,
				locale: true
			}
		}),
		getResumeTemplatesForProfile(layoutData.selectedProfile.id),
		db
			.selectDistinct({ locale: profile_translations.locale })
			.from(profile_translations)
			.where(eq(profile_translations.profile_id, layoutData.selectedProfile.id))
	]);

	// The selected template is a page-level lens from ?template=; fall back to the
	// built-in default when the slug isn't one of this profile's templates.
	const rawTemplate = url.searchParams.get('template') ?? DEFAULT_TEMPLATE_ID;
	const selectedTemplate = templates.some((t) => t.slug === rawTemplate)
		? rawTemplate
		: DEFAULT_TEMPLATE_ID;
	const templateFilter = templateForStorage(selectedTemplate);

	// Language is a page-level lens from ?lang=. Only offer English plus locales
	// the profile actually has translations for.
	const translated = new Set(translatedLocaleRows.map((r) => r.locale));
	const availableLocales = LOCALES.filter((l) => l.code === BASE_LOCALE || translated.has(l.code));
	const rawLang = url.searchParams.get('lang');
	const selectedLocale =
		isKnownLocale(rawLang) && availableLocales.some((l) => l.code === rawLang)
			? rawLang
			: BASE_LOCALE;
	const localeFilter = selectedLocale === BASE_LOCALE ? null : selectedLocale;

	const publicResumeVersionId = profile?.public_resume_version_id ?? null;
	const publicCvVersionId = profile?.public_cv_version_id ?? null;

	// A stored export belongs to this version+template+locale when its
	// export_format is the version slug (new format) or its description mentions
	// "(slug)" (legacy), and its template/locale columns match the selected lens
	// (null = default template / base English).
	const matchesVersionTemplate = (
		e: {
			export_format: string | null;
			description: string | null;
			template: string | null;
			locale: string | null;
		},
		slug: string | null
	) =>
		(e.template ?? null) === templateFilter &&
		(e.locale ?? null) === localeFilter &&
		(e.export_format === slug || (!!slug && !!e.description?.includes(`(${slug})`)));

	const mapped = versions.map(({ extension_links: exts, ...v }) => {
		const hasResumePdf = profileExports.some(
			(e) => e.export_type === 'resume' && matchesVersionTemplate(e, v.slug)
		);
		const hasCvPdf = profileExports.some(
			(e) => e.export_type === 'cv' && matchesVersionTemplate(e, v.slug)
		);
		return {
			...v,
			extendsIds: exts?.map((e) => e.extended_id).filter((id): id is number => id !== null) ?? [],
			hasResumePdf,
			hasCvPdf
		};
	});

	// Put public resume first, then public cv, then the rest sorted by name
	const publicIds = new Set([publicResumeVersionId, publicCvVersionId].filter(Boolean));
	const pinned = [publicResumeVersionId, publicCvVersionId]
		.filter((id): id is number => id !== null)
		.map((id) => mapped.find((v) => v.id === id)!)
		.filter(Boolean);
	// Deduplicate if both point to the same version
	const pinnedUnique = [...new Map(pinned.map((v) => [v.id, v])).values()];
	const rest = mapped.filter((v) => !publicIds.has(v.id));

	return {
		versions: [...pinnedUnique, ...rest],
		profileId: layoutData.selectedProfile.id,
		publicResumeVersionId,
		publicCvVersionId,
		templates,
		selectedTemplate,
		availableLocales,
		selectedLocale
	};
};

export const actions: Actions = {
	create: async ({ request, locals, cookies }) => {
		const user = locals.user;
		if (!user) {
			return fail(401, { error: 'Not authenticated' });
		}

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) {
			return fail(400, { error: 'No profile selected' });
		}

		const formData = await request.formData();
		let slug = (formData.get('slug') as string)?.trim() || '';
		const name = formData.get('name') as string;
		const extendsIds = formData
			.getAll('extendsIds')
			.map((v) => parseInt(v as string))
			.filter((v) => !isNaN(v));

		// Auto-generate slug from name if not provided
		if (!slug && name?.trim()) {
			slug = name
				.toLowerCase()
				.trim()
				.replace(/[^\w\s-]/g, '')
				.replace(/[\s_]+/g, '-')
				.replace(/-+/g, '-')
				.replace(/^-+|-+$/g, '');
		}

		if (!slug) {
			return fail(400, { error: 'Name is required' });
		}

		const [created] = await db
			.insert(profile_versions)
			.values({
				slug,
				name: name?.trim() || null,
				profile_id: profileId,
				date_created: new Date()
			})
			.returning();

		for (const parentId of extendsIds) {
			const parent = await db.query.profile_versions.findFirst({
				where: and(eq(profile_versions.id, parentId), eq(profile_versions.profile_id, profileId))
			});
			if (parent) {
				await db.insert(profile_version_extensions).values({
					extender_id: created.id,
					extended_id: parentId
				});
			}
		}

		await requireCredits(user.id, 1);
		await chargeCredits(user.id, 1, 'pdf_export', 'PDF export');
		generateVersionPdfs(profileId, slug.trim()).catch(console.error);

		return { success: true };
	},

	generateExports: async ({ request, locals, cookies }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Not authenticated' });

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) return fail(400, { error: 'No profile selected' });

		const formData = await request.formData();
		const slug = (formData.get('slug') as string) || '';
		if (!slug) return fail(400, { error: 'No version specified' });

		// Validate the requested template against this profile's templates.
		const rawTemplate = (formData.get('template') as string) || DEFAULT_TEMPLATE_ID;
		const templates = await getResumeTemplatesForProfile(profileId);
		const templateId = templates.some((t) => t.slug === rawTemplate)
			? rawTemplate
			: DEFAULT_TEMPLATE_ID;

		const version = await db.query.profile_versions.findFirst({
			where: and(eq(profile_versions.profile_id, profileId), eq(profile_versions.slug, slug))
		});
		if (!version) return fail(404, { error: 'Version not found' });

		const rawLocale = (formData.get('locale') as string) || '';
		const locale = isKnownLocale(rawLocale) && rawLocale !== BASE_LOCALE ? rawLocale : null;

		await requireCredits(user.id, 1);
		await chargeCredits(user.id, 1, 'pdf_export', 'PDF export');
		await generateVersionPdfs(profileId, slug, templateForStorage(templateId), locale);

		return { success: true, generatedSlug: slug, template: templateId, locale };
	}
};
