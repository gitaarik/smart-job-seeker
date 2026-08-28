import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { dbDirect as db } from '$lib/server/db';
import { and, asc, eq, inArray, isNull, or } from 'drizzle-orm';
import {
	applications,
	profile_exports,
	profile_translations,
	profile_version_extensions,
	profile_version_overrides,
	profile_versions,
	profiles
} from '$lib/server/db/schema';
import { getSelectedProfileId } from '../../../profile/utils';
import { DEFAULT_TEMPLATE_ID, templateForStorage } from '$lib/resume-templates';
import { getResumeTemplatesForProfile } from '$lib/server/profile/resume-templates';
import { BASE_LOCALE, isKnownLocale, LOCALES } from '$lib/resume-translations';
import { getLatestExport } from '$lib/server/profile/export-files';
import { exportKey } from '$lib/utils/profile-doc-url';
import { getVersionCoverage } from '$lib/server/profile/hidden-required-skills';
import { specWarning } from '$lib/version-coverage';
import {
	decisionsForVersion,
	describeOverrides,
	jobMatchRead,
	promoteToLibrary,
	relevantExclusionsByVersion,
	retagVersionSlug,
	setItemStateForApplication,
	tailorVersionForApplication,
	versionItemStates,
	type VersionReach
} from '$lib/server/profile/tailor-version';
import { isOverrideEntity } from '$lib/version-overrides';
import { generateVersionPdfs } from '$lib/server/profile/generate-version-pdfs';

/** How the document going to this job is presented: which template, which language. */
interface SentAs {
	/** Template slug in storage form — null is the built-in default. */
	template: string | null;
	/** Locale code — null is the base English. */
	locale: string | null;
}

/** What the application records about presentation, in storage form. */
async function sentAs(profileId: number, appId: number): Promise<SentAs> {
	const row = await db.query.applications.findFirst({
		where: and(eq(applications.id, appId), eq(applications.profile_id, profileId)),
		columns: { cv_template_sent: true, cv_locale_sent: true }
	});
	return { template: row?.cv_template_sent ?? null, locale: row?.cv_locale_sent ?? null };
}

/**
 * Keep the tailored version's PDF in step with its decisions.
 *
 * `/p/[slug]/resume.pdf` serves a stored export and renders nothing on demand,
 * so a version nobody ever exported 404s — which is what the PDF link on this
 * page did from the day it was added. Fire-and-forget, like every other caller:
 * a failed render leaves the previous file, and the link is a convenience, not
 * the save path.
 *
 * Rendered in the template and language THIS application records, because a
 * stored export is keyed by both: refreshing the default-template English pair
 * for an application sending the branded Dutch one leaves the document it
 * actually links to untouched. Callers that just changed those columns pass the
 * new values in `as` — reading them back here would race their own update.
 */
function refreshPdfs(
	profileId: number,
	appId: number,
	slug: string | null | undefined,
	as?: SentAs
): void {
	if (!slug) return;
	Promise.resolve(as ?? sentAs(profileId, appId))
		.then(({ template, locale }) => generateVersionPdfs(profileId, slug, template, locale))
		.catch((err) => console.error('[tailor-version] PDF refresh failed for', slug, err));
}

/**
 * Read a template + language choice off a submitted form, in storage form.
 *
 * Validated against what this profile actually has: a template slug that isn't
 * one of its own, or a locale it has no translations for, falls back to the
 * built-in default rather than being recorded — the record has to name a
 * document that can be produced.
 */
async function readSentAs(profileId: number, formData: FormData): Promise<SentAs> {
	const rawTemplate = ((formData.get('template') as string) || DEFAULT_TEMPLATE_ID).trim();
	const templates =
		rawTemplate && rawTemplate !== DEFAULT_TEMPLATE_ID
			? await getResumeTemplatesForProfile(profileId)
			: [];
	const template = templates.some((t) => t.slug === rawTemplate)
		? templateForStorage(rawTemplate)
		: null;

	const rawLocale = ((formData.get('locale') as string) || '').trim();
	let locale: string | null = null;
	if (isKnownLocale(rawLocale) && rawLocale !== BASE_LOCALE) {
		const translated = await db
			.selectDistinct({ locale: profile_translations.locale })
			.from(profile_translations)
			.where(eq(profile_translations.profile_id, profileId));
		locale = translated.some((r) => r.locale === rawLocale) ? rawLocale : null;
	}

	return { template, locale };
}

/**
 * The version list and the coverage map feed CvSentCard, which moved here from
 * the Documents tab: "which version did I send them?" is application state, not
 * activity, and it was the one thing on that page unrelated to attached files.
 */
export const load: PageServerLoad = async ({ parent, params }) => {
	const layoutData = await parent();
	if (!layoutData.selectedProfile) return {};

	const requiredSkills = layoutData.application?.job?.skills_required;
	const applicationId = parseInt(params.id);

	const [profileVersions, coverage, profile, templates, translatedLocaleRows, pdfExports] =
		await Promise.all([
			db.query.profile_versions.findMany({
				// The applicant's library, plus this application's own tailored version
				// if one exists. Versions belonging to OTHER applications are somebody
				// else's business and never appear in this picker.
				where: and(
					eq(profile_versions.profile_id, layoutData.selectedProfile.id),
					eq(profile_versions.status, 'published'),
					isNaN(applicationId)
						? isNull(profile_versions.application_id)
						: or(
								isNull(profile_versions.application_id),
								eq(profile_versions.application_id, applicationId)
							)
				),
				columns: {
					id: true,
					slug: true,
					name: true,
					application_id: true,
					// When a run last decided this document — see `profileMovedOn`.
					date_updated: true
				},
				orderBy: asc(profile_versions.sort)
			}),
			// Precomputed for every template x version pair rather than just the saved
			// one: the type and version pickers are unsaved client state, so the page
			// must be able to answer for whatever the applicant is currently eyeing.
			getVersionCoverage(
				layoutData.selectedProfile.id,
				Array.isArray(requiredSkills) ? (requiredSkills as string[]) : [],
				{
					applicationId: isNaN(applicationId) ? null : applicationId,
					// Whether a role's technologies print is the template's answer, and
					// the recorded one is the document this application is sending —
					// same reference point as the PDF links and the diff below.
					template: layoutData.application?.cv_template_sent ?? null
				}
			),
			// What this profile sends when nobody names a version — the sensible thing
			// to build a tailored version ON. The plain, version-less document is not:
			// it discards the applicant's curation, and for a profile with a public
			// version set it is not even reachable as a document.
			db.query.profiles.findFirst({
				where: eq(profiles.id, layoutData.selectedProfile.id),
				columns: {
					public_resume_version_id: true,
					public_cv_version_id: true,
					// Bumped by touchProfile on every child-record edit — a skill, a
					// bullet, a project. The cheap half of the staleness question.
					date_updated: true
				}
			}),
			// How the document can be presented. Both are part of what gets recorded
			// here rather than a lens over a list, so the card offers them beside the
			// version — and offers nothing at all to a profile that has neither, which
			// is most of them.
			getResumeTemplatesForProfile(layoutData.selectedProfile.id),
			db
				.selectDistinct({ locale: profile_translations.locale })
				.from(profile_translations)
				.where(eq(profile_translations.profile_id, layoutData.selectedProfile.id)),
			// Which PDFs actually exist. A stored export is keyed by version AND
			// template AND language, and nothing renders one on demand, so whether the
			// PDF link works is a real question with a per-combination answer.
			db.query.profile_exports.findMany({
				where: and(
					eq(profile_exports.profile_id, layoutData.selectedProfile.id),
					eq(profile_exports.status, 'published'),
					eq(profile_exports.file_type, 'pdf'),
					inArray(profile_exports.export_type, ['resume', 'cv'])
				),
				columns: {
					description: true,
					export_type: true,
					export_format: true,
					template: true,
					locale: true
				}
			})
		]);

	const usable = profileVersions.filter((v) => v.slug && v.name) as {
		id: number;
		slug: string;
		name: string;
		application_id: number | null;
		date_updated: Date | null;
	}[];

	const defaultBase = {
		resume: usable.find((v) => v.id === profile?.public_resume_version_id)?.slug ?? '',
		cv: usable.find((v) => v.id === profile?.public_cv_version_id)?.slug ?? ''
	};

	const tailoredRow = usable.find((v) => v.application_id !== null) ?? null;

	// English plus the languages this profile has actually translated into.
	const translated = new Set(translatedLocaleRows.map((r) => r.locale));
	const availableLocales = LOCALES.filter((l) => l.code === BASE_LOCALE || translated.has(l.code));

	/**
	 * Every (document type, version, template, language) combination that has a
	 * PDF on disk, as flat keys the card can test a selection against.
	 *
	 * The version is read off `export_format` (current) or out of the "(slug)"
	 * in the description (legacy), the same two ways the profile library reads
	 * it. Combinations nobody has rendered are simply absent, which is the whole
	 * point: the card can then offer to render one instead of linking a 404.
	 */
	const knownSlugs = usable.map((v) => v.slug);
	const pdfKeys = [
		...new Set(
			pdfExports.flatMap((e) => {
				const slug = knownSlugs.find(
					(sl) => e.export_format === sl || e.description?.includes(`(${sl})`)
				);
				return slug ? [exportKey(e.export_type, slug, e.template, e.locale)] : [];
			})
		)
	];

	// Which library version it currently extends. The regenerate control has to
	// show the real answer: defaulting it back to the recommendation would
	// silently rebase the version on the next regenerate.
	const currentBase = tailoredRow
		? await db.query.profile_version_extensions.findFirst({
				where: eq(profile_version_extensions.extender_id, tailoredRow.id),
				columns: { extended_id: true }
			})
		: null;
	/**
	 * Whether the profile has changed since a run last decided this document.
	 *
	 * New content does not need a rerun to appear — a tailored version is a
	 * sidecar of decisions over live profile data, so an achievement added
	 * afterwards has no exclusion row and simply prints. What ages is the
	 * DECIDING: the surfacing, the ordering, and the page budget the run fitted
	 * the document to. Add three bullets to a document trimmed to two pages and
	 * it quietly becomes longer than the run ever checked.
	 *
	 * Deliberately coarse. `touchProfile` bumps this for any child edit, a new
	 * language included, so the notice claims "something moved, a rerun is
	 * cheap" and not "this document is wrong". Narrowing it to the entities a
	 * run actually decided about is a lot of bookkeeping for a nudge that sits
	 * next to a one-click button.
	 *
	 * Null on a version built before runs started stamping themselves: unknown,
	 * so it says nothing rather than nagging every version that predates this.
	 */
	const profileMovedOn =
		!!tailoredRow?.date_updated &&
		!!profile?.date_updated &&
		profile.date_updated > tailoredRow.date_updated;

	const tailored = tailoredRow
		? {
				...tailoredRow,
				baseSlug:
					usable.find((v) => v.id === currentBase?.extended_id)?.slug ??
					(currentBase?.extended_id ? null : '')
			}
		: null;

	// The annotated diff, and what selection cannot fix. Both only matter once a
	// tailored version exists, so neither costs anything until then.
	const [decisions, matchRead, reach] = await Promise.all([
		tailored ? decisionsForVersion(tailored.id).then(describeOverrides) : Promise.resolve([]),
		layoutData.application?.job?.id
			? jobMatchRead(layoutData.selectedProfile.id, layoutData.application.job.id)
			: Promise.resolve({ gaps: [], matched: [] }),
		// What each candidate document leaves out that speaks to this job, and
		// what it puts beyond reach entirely — the measure the base suggestion
		// ranks on. Free after the first view: item vectors and the job's own
		// vector are cached.
		isNaN(applicationId)
			? Promise.resolve<VersionReach>({ exclusions: {}, outOfReach: {}, heldBackParents: {} })
			: relevantExclusionsByVersion({
					profileId: layoutData.selectedProfile.id,
					applicationId,
					versionSlugs: ['', ...usable.map((v) => v.slug)]
				})
	]);

	/**
	 * Required skills the match CREDITS the applicant with, through something
	 * related, while no skill of theirs carries the word itself.
	 *
	 * The third state between "you have it and it prints" and "you don't have
	 * it": the matcher counts SQL through MySQL and Linux through Linode, but a
	 * document that prints those does not print these, and a keyword search for
	 * them finds nothing. Computed against the same exact-name join the coverage
	 * map uses, so the two never double-count a skill.
	 */
	const namedByProfile = new Set(
		Object.values(coverage).flatMap((entry) => [
			...entry.shown.map((n) => n.toLowerCase()),
			...entry.hidden.map((h) => h.name.toLowerCase())
		])
	);
	const matchedLower = new Set(matchRead.matched.map((s) => s.trim().toLowerCase()));
	const requiredList = Array.isArray(requiredSkills) ? (requiredSkills as string[]) : [];
	const creditedNotNamed = requiredList.filter((skill) => {
		const key = skill.trim().toLowerCase();
		return key && matchedLower.has(key) && !namedByProfile.has(key);
	});

	/**
	 * Everything the document being sent could print, for the panel that edits it.
	 *
	 * Described for the tailored version when there is one, else for whatever is
	 * recorded — the two flows the panel serves. With nothing recorded there is
	 * no document to describe, and the panel stays out of the way.
	 */
	const panelType = layoutData.application?.cv_sent_through === 'cv' ? 'cv' : 'resume';
	const panelSlug =
		tailored?.slug ??
		(layoutData.application?.cv_sent_through
			? (layoutData.application?.cv_version_sent ?? '')
			: null);
	const items =
		panelSlug === null
			? []
			: await versionItemStates({
					profileId: layoutData.selectedProfile.id,
					applicationId: isNaN(applicationId) ? null : applicationId,
					docType: panelType,
					versionSlug: panelSlug
				});

	return {
		versions: usable
			.filter((v) => v.application_id === null)
			.map(({ slug, name }) => ({ slug, name })),
		items,
		tailored,
		profileMovedOn,
		coverage,
		decisions,
		gaps: matchRead.gaps,
		creditedNotNamed,
		exclusions: reach.exclusions,
		outOfReach: reach.outOfReach,
		heldBackParents: reach.heldBackParents,
		defaultBase,
		templates: templates.map((t) => ({ slug: t.slug, name: t.name })),
		availableLocales,
		pdfKeys,
		// Everything on this page keys off the job's required skills, and an empty
		// list makes every pass quietly do less while producing a document that
		// looks exactly like a good one. Said out loud rather than left silent.
		specWarning: specWarning(
			requiredSkills,
			(layoutData.application?.job?.job_description ?? '').length
		)
	};
};

export const actions: Actions = {
	/**
	 * Generate — or regenerate — the version tailored to this job, and record it
	 * as the document going out.
	 *
	 * The base version defaults to whatever the coverage ranking recommends and
	 * is stated rather than asked: a tailored version is a DELTA on a library
	 * version, so which one it extends is the most consequential input here —
	 * consequential enough to show, not to open with.
	 */
	tailorVersion: async ({ request, locals, cookies, params }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Not authenticated' });

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) return fail(400, { error: 'No profile selected' });

		const appId = parseInt(params.id);
		if (isNaN(appId)) return fail(400, { error: 'Invalid application ID' });

		const formData = await request.formData();
		const docType = (formData.get('doc_type') as string) === 'cv' ? 'cv' : 'resume';
		const baseSlug = ((formData.get('base_slug') as string) || '').trim();
		// Presentation travels with the run: the PDF it renders is the one the
		// card then links, and rendering it in a template the applicant did not
		// ask for means the first thing they open is the wrong document.
		const as = await readSentAs(profileId, formData);

		try {
			const result = await tailorVersionForApplication({
				profileId,
				applicationId: appId,
				docType,
				baseSlug,
				// The same presentation the PDF below is rendered in. Withholding it
				// was the whole bug: the fit pass promised two pages of the plain
				// template while the applicant downloaded three of a branded one.
				template: as.template
			});
			refreshPdfs(profileId, appId, result.versionSlug, as);

			// Tailoring records itself. Generating a version for one job and then
			// having to select it from a dropdown to say you were sending it is
			// what made this page read as two competing questions — and nobody
			// tailors a version for a job they then send something else to. It
			// takes the record even when a library version held it: the applicant
			// asked for this document, and changing back is one click above.
			await db
				.update(applications)
				.set({
					cv_version_sent: result.versionSlug,
					cv_sent_through: docType,
					cv_template_sent: as.template,
					cv_locale_sent: as.locale,
					date_updated: new Date()
				})
				.where(and(eq(applications.id, appId), eq(applications.profile_id, profileId)));

			return { success: true, tailored: result };
		} catch (error) {
			return fail(400, {
				error: error instanceof Error ? error.message : 'Could not tailor a version.'
			});
		}
	},

	/**
	 * Reject one proposed decision. Deleting the row is the whole undo: the item
	 * falls back to what the applicant's own tags say, which is where it was
	 * before anything was generated.
	 */
	rejectDecision: async ({ request, locals, cookies, params }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Not authenticated' });

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) return fail(400, { error: 'No profile selected' });

		const appId = parseInt(params.id);
		const formData = await request.formData();
		const decisionId = parseInt((formData.get('decision_id') as string) || '');
		if (isNaN(decisionId) || isNaN(appId)) return fail(400, { error: 'Invalid decision' });

		// Ownership: the row must belong to a version owned by THIS application,
		// which must belong to the selected profile.
		const version = await db.query.profile_versions.findFirst({
			where: and(
				eq(profile_versions.profile_id, profileId),
				eq(profile_versions.application_id, appId)
			),
			columns: { id: true, slug: true }
		});
		if (!version) return fail(404, { error: 'No tailored version for this application' });

		await db
			.delete(profile_version_overrides)
			.where(
				and(
					eq(profile_version_overrides.id, decisionId),
					eq(profile_version_overrides.version_id, version.id)
				)
			);
		refreshPdfs(profileId, appId, version.slug);
		return { success: true };
	},

	/**
	 * Keep one decision through future regenerations by marking it the
	 * applicant's own — `source` is what stops a rerun undoing a judgement
	 * somebody made by hand.
	 */
	keepDecision: async ({ request, locals, cookies, params }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Not authenticated' });

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) return fail(400, { error: 'No profile selected' });

		const appId = parseInt(params.id);
		const formData = await request.formData();
		const decisionId = parseInt((formData.get('decision_id') as string) || '');
		if (isNaN(decisionId) || isNaN(appId)) return fail(400, { error: 'Invalid decision' });

		const version = await db.query.profile_versions.findFirst({
			where: and(
				eq(profile_versions.profile_id, profileId),
				eq(profile_versions.application_id, appId)
			),
			columns: { id: true, slug: true }
		});
		if (!version) return fail(404, { error: 'No tailored version for this application' });

		await db
			.update(profile_version_overrides)
			.set({ source: 'user', date_updated: new Date() })
			.where(
				and(
					eq(profile_version_overrides.id, decisionId),
					eq(profile_version_overrides.version_id, version.id)
				)
			);
		return { success: true };
	},

	/**
	 * Keep this version: move it into the library, decisions and all.
	 *
	 * The applicant is saying the selection made for one job is a document worth
	 * reusing — so it keeps its overrides and stops being tied to this
	 * application's lifecycle. It also stops being regenerable from here, which
	 * is the trade: a library version is theirs to edit, not ours to overwrite.
	 */
	promoteTailored: async ({ request, locals, cookies, params }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Not authenticated' });

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) return fail(400, { error: 'No profile selected' });

		const appId = parseInt(params.id);
		if (isNaN(appId)) return fail(400, { error: 'Invalid application ID' });

		const formData = await request.formData();
		const name = ((formData.get('name') as string) || '').trim();

		try {
			const promoted = await promoteToLibrary({ profileId, applicationId: appId, name });
			// The slug changes here, and exports are keyed by it — without this a
			// promoted version has no PDF under the name it now goes by.
			refreshPdfs(profileId, appId, promoted.slug);
			return { success: true, promoted };
		} catch (error) {
			return fail(400, {
				error: error instanceof Error ? error.message : 'Could not promote this version.'
			});
		}
	},

	/**
	 * Put one item back on the tailored version for this job.
	 *
	 * Recorded as the applicant's own decision, not the generator's, so a later
	 * regeneration leaves it alone — asking for something back and having the
	 * next run drop it again would make the control worthless.
	 */
	includeInTailored: async ({ request, locals, cookies, params }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Not authenticated' });

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) return fail(400, { error: 'No profile selected' });

		const appId = parseInt(params.id);
		if (isNaN(appId)) return fail(400, { error: 'Invalid application ID' });

		const formData = await request.formData();
		const entityType = (formData.get('entity_type') as string) || '';
		const entityId = parseInt((formData.get('entity_id') as string) || '');
		if (!isOverrideEntity(entityType) || isNaN(entityId)) {
			return fail(400, { error: 'Invalid item' });
		}

		const version = await db.query.profile_versions.findFirst({
			where: and(
				eq(profile_versions.profile_id, profileId),
				eq(profile_versions.application_id, appId)
			),
			columns: { id: true, slug: true }
		});
		if (!version) return fail(404, { error: 'No tailored version for this application' });

		const now = new Date();
		await db
			.insert(profile_version_overrides)
			.values({
				version_id: version.id,
				entity_type: entityType,
				entity_id: entityId,
				action: 'include',
				reason: 'you asked for this back',
				source: 'user',
				date_created: now,
				date_updated: now
			})
			.onConflictDoUpdate({
				target: [
					profile_version_overrides.version_id,
					profile_version_overrides.entity_type,
					profile_version_overrides.entity_id
				],
				set: {
					action: 'include',
					sort: null,
					reason: 'you asked for this back',
					source: 'user',
					date_updated: now
				}
			});

		refreshPdfs(profileId, appId, version.slug);
		return { success: true };
	},

	/** Throw the tailored version away; its decisions cascade with it. */
	/**
	 * Show or hide one item on this job's document.
	 *
	 * Generalises includeInTailored, which could only ever add and only ever to a
	 * version that already existed. This one also creates that version, which is
	 * what makes the panel work on a library version: editing what a document
	 * shows for one job IS tailoring it, and the first toggle is as good a moment
	 * to say so as any.
	 */
	setItemState: async ({ request, locals, cookies, params }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Not authenticated' });

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) return fail(400, { error: 'No profile selected' });

		const appId = parseInt(params.id);
		if (isNaN(appId)) return fail(400, { error: 'Invalid application ID' });

		const formData = await request.formData();
		const entityType = (formData.get('entity_type') as string) || '';
		const entityId = parseInt((formData.get('entity_id') as string) || '');
		if (!isOverrideEntity(entityType) || isNaN(entityId)) {
			return fail(400, { error: 'Invalid item' });
		}
		const docType = (formData.get('doc_type') as string) === 'cv' ? 'cv' : 'resume';
		const baseSlug = ((formData.get('base_slug') as string) || '').trim();
		const on = (formData.get('on') as string) === '1';

		try {
			const result = await setItemStateForApplication({
				profileId,
				applicationId: appId,
				docType,
				baseSlug,
				entityType,
				entityId,
				on
			});
			refreshPdfs(profileId, appId, result.versionSlug);

			// A version made by a toggle is still the document going to this job,
			// and for the same reason a generated one is: nothing else asked for it.
			if (result.created) {
				await db
					.update(applications)
					.set({
						cv_version_sent: result.versionSlug,
						cv_sent_through: docType,
						date_updated: new Date()
					})
					.where(and(eq(applications.id, appId), eq(applications.profile_id, profileId)));
			}
			return { success: true };
		} catch (error) {
			return fail(400, {
				error: error instanceof Error ? error.message : 'Could not change that item.'
			});
		}
	},

	discardTailored: async ({ locals, cookies, params }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Not authenticated' });

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) return fail(400, { error: 'No profile selected' });

		const appId = parseInt(params.id);
		if (isNaN(appId)) return fail(400, { error: 'Invalid application ID' });

		const doomed = await db.query.profile_versions.findFirst({
			where: and(
				eq(profile_versions.profile_id, profileId),
				eq(profile_versions.application_id, appId)
			),
			columns: { id: true, slug: true }
		});
		if (!doomed) return { success: true };

		// Explicitly, not by cascade: both extension FKs are ON DELETE SET NULL,
		// so letting the delete take them leaves a half-null row behind that
		// nothing owns and nothing cleans up.
		await db
			.delete(profile_version_extensions)
			.where(
				or(
					eq(profile_version_extensions.extender_id, doomed.id),
					eq(profile_version_extensions.extended_id, doomed.id)
				)
			);

		await db.delete(profile_versions).where(eq(profile_versions.id, doomed.id));

		// Overrides cascade with the row; tags naming its slug do not, and would
		// sit on the profile pointing at a version that no longer exists —
		// invisible until this application tailored a second version, which gets
		// the same deterministic slug and would quietly inherit them.
		if (doomed.slug) await retagVersionSlug(profileId, doomed.slug, null);

		// Clear the record only if it pointed at the version just deleted, which
		// would now render as a broken link. An applicant who recorded sending a
		// LIBRARY version said something true, and discarding this draft must not
		// erase it.
		//
		// Both columns go, not just the slug: leaving the document type behind
		// would read as "sent the plain resume", which is a different claim from
		// the one that was made and no longer a true one.
		if (doomed.slug) {
			await db
				.update(applications)
				.set({
					cv_version_sent: null,
					cv_sent_through: null,
					cv_template_sent: null,
					cv_locale_sent: null,
					date_updated: new Date()
				})
				.where(
					and(
						eq(applications.id, appId),
						eq(applications.profile_id, profileId),
						eq(applications.cv_version_sent, doomed.slug)
					)
				);
		}
		return { success: true };
	},

	/**
	 * Put the send-record back to nothing recorded.
	 *
	 * `setCvSent` cannot express this: the form always posts a document type, so
	 * "no version" saves as "sent the plain resume" and the card is decided
	 * forever after. Recording something you did not do is a worse failure than
	 * recording nothing, and there was no way back.
	 */
	clearCvSent: async ({ locals, cookies, params }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Not authenticated' });

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) return fail(400, { error: 'No profile selected' });

		const appId = parseInt(params.id);
		if (isNaN(appId)) return fail(400, { error: 'Invalid application ID' });

		await db
			.update(applications)
			.set({
				cv_version_sent: null,
				cv_sent_through: null,
				cv_template_sent: null,
				cv_locale_sent: null,
				date_updated: new Date()
			})
			.where(and(eq(applications.id, appId), eq(applications.profile_id, profileId)));

		return { success: true };
	},

	setCvSent: async ({ request, locals, cookies, params }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Not authenticated' });

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) return fail(400, { error: 'No profile selected' });

		const appId = parseInt(params.id);
		if (isNaN(appId)) return fail(400, { error: 'Invalid application ID' });

		const existing = await db.query.applications.findFirst({
			where: and(eq(applications.id, appId), eq(applications.profile_id, profileId))
		});
		if (!existing) return fail(404, { error: 'Application not found' });

		const formData = await request.formData();
		const versionSlug = (formData.get('version_slug') as string) || null;
		const cvSentThrough = (formData.get('cv_sent_through') as string) || null;
		const as = await readSentAs(profileId, formData);

		await db
			.update(applications)
			.set({
				cv_version_sent: versionSlug,
				cv_sent_through: cvSentThrough,
				cv_template_sent: as.template,
				cv_locale_sent: as.locale,
				date_updated: new Date()
			})
			.where(eq(applications.id, appId));

		// Make the record's own PDF link work.
		//
		// Exports are keyed by version AND template AND language and nothing
		// renders one on demand, so picking a template the applicant has never
		// exported this version in — which is the normal case, since the library
		// only renders what its own switcher was on — records a document whose PDF
		// 404s. Rendered here, while the applicant is waiting on a save they just
		// asked for, rather than left as a chore they have to discover.
		//
		// Not charged, unlike the library's Generate button: every other write on
		// this page already refreshes PDFs for free, and a save that silently cost
		// a credit because a select moved would be a worse surprise than the
		// inconsistency.
		let pdfError: string | null = null;
		if (versionSlug) {
			const docType = cvSentThrough === 'cv' ? 'cv' : 'resume';
			const existing = await getLatestExport({
				profileId,
				exportType: docType,
				fileType: 'pdf',
				exportFormat: versionSlug,
				template: as.template,
				locale: as.locale
			});
			if (!existing) {
				try {
					await generateVersionPdfs(profileId, versionSlug, as.template, as.locale);
				} catch (err) {
					console.error('[tailor-version] PDF render failed for', versionSlug, err);
					pdfError = "Saved, but the PDF couldn't be rendered. Try again from the PDF button.";
				}
			}
		}

		return { success: true, pdfError };
	},

	/**
	 * Render the PDF for what this application records it is sending.
	 *
	 * The repair path for the one thing `setCvSent` cannot guarantee: a render
	 * that failed, or a record made before presentation was part of it. Awaited,
	 * because the button that calls it says it is making a file.
	 */
	generatePdfs: async ({ locals, cookies, params }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Not authenticated' });

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) return fail(400, { error: 'No profile selected' });

		const appId = parseInt(params.id);
		if (isNaN(appId)) return fail(400, { error: 'Invalid application ID' });

		const app = await db.query.applications.findFirst({
			where: and(eq(applications.id, appId), eq(applications.profile_id, profileId)),
			columns: { cv_version_sent: true, cv_template_sent: true, cv_locale_sent: true }
		});
		if (!app?.cv_version_sent) return fail(400, { error: 'No version recorded for this job' });

		try {
			await generateVersionPdfs(
				profileId,
				app.cv_version_sent,
				app.cv_template_sent,
				app.cv_locale_sent
			);
			return { success: true };
		} catch (err) {
			console.error('[tailor-version] PDF render failed for', app.cv_version_sent, err);
			return fail(500, { error: "The PDF couldn't be rendered. Try again in a moment." });
		}
	}
};
