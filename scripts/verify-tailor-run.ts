#!/usr/bin/env npx tsx
/**
 * A tailoring run, against a real database, end to end and self-cleaning.
 *
 * The rules are unit-tested ($lib/tailoring), and so is the assembly around
 * them (profile/__tests__/tailor-version-db.test.ts). What neither can reach is
 * the run itself: whether the rows the selector produces can actually be
 * written, whether a rerun replaces its own work without touching the
 * applicant's, and whether the version it builds extends the library version it
 * was asked to build on.
 *
 * Three things here are only true against Postgres:
 *
 *   - `profile_version_overrides` is unique on (version_id, entity_type,
 *     entity_id) and `persistDecisions` inserts without a conflict clause, so a
 *     selector that emitted one entity twice would throw. A mock accepts it.
 *   - `source = 'user'` rows survive a rerun and AI rows do not. That is a
 *     delete-then-insert against real rows, and it is the guarantee that stops
 *     a regeneration quietly undoing a judgement someone made by hand.
 *   - regenerating against a DIFFERENT base has to move the extension link.
 *     Without it the selection is computed against one document and rendered
 *     against another, and every verdict in the diff answers about a document
 *     nobody is looking at.
 *
 * It creates its own job, application and library versions, runs against those,
 * and deletes everything it made — so it is re-runnable, and it never touches a
 * row that was there before it started. The profile is only ever READ.
 *
 * **It calls the model**, once per run, because that is what the real path
 * does; a few cents, like llm:smoke. The run degrades to the deterministic
 * layers if the call fails, and the script reports which happened rather than
 * insisting on either.
 *
 *   npx dotenvx run -f /app/.env -- npx tsx scripts/verify-tailor-run.ts <profileId>
 *
 * or from cloud/: npm run db:verify-tailor-run -- <profileId>
 */
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	applications,
	jobs,
	profile_version_extensions,
	profile_version_overrides,
	profile_versions,
	profiles
} from '$lib/server/db/schema';
import {
	decisionsForVersion,
	describeOverrides,
	tailorVersionForApplication
} from '$lib/server/profile/tailor-version';
import { tailoredSlugFor } from '$lib/version-overrides';

const profileId = Number(process.argv[2]);
if (!Number.isInteger(profileId)) {
	console.error('usage: verify-tailor-run.ts <profileId>');
	process.exit(1);
}

const SCRATCH = 'verify-tailor-run';

/** Everything this run created, so the finally block can undo all of it. */
const made = { jobId: 0, applicationId: 0, versionIds: [] as number[] };

let failures = 0;
function check(what: string, ok: boolean, detail: unknown = '') {
	console.log(`${ok ? '  ok  ' : ' FAIL '} ${what}${detail === '' ? '' : `  → ${detail}`}`);
	if (!ok) failures++;
}

/** A job with enough of a spec to rank a profile against. */
async function makeJob(): Promise<number> {
	const [row] = await db
		.insert(jobs)
		.values({
			title: `${SCRATCH} — Senior Backend Engineer`,
			company: SCRATCH,
			job_description:
				'We run data pipelines and APIs in Python. You will own services in production, ' +
				'work with Postgres and Docker, and improve how we deploy and observe them.',
			skills_required: ['Python', 'PostgreSQL', 'Docker'],
			skills_preferred: ['Kubernetes', 'Airflow'],
			responsibilities: ['Own backend services end to end', 'Improve deployment and observability'],
			status: 'published',
			created_manually: true
		})
		.returning({ id: jobs.id });
	made.jobId = row.id;
	return row.id;
}

/** A library version to build on, so the extension link has something to point at. */
async function makeLibraryVersion(slug: string): Promise<number> {
	const [row] = await db
		.insert(profile_versions)
		.values({
			profile_id: profileId,
			slug,
			name: slug,
			status: 'published',
			date_created: new Date()
		})
		.returning({ id: profile_versions.id });
	made.versionIds.push(row.id);
	return row.id;
}

async function overridesOf(versionId: number) {
	return db.query.profile_version_overrides.findMany({
		where: eq(profile_version_overrides.version_id, versionId)
	});
}

async function extendedIdOf(versionId: number): Promise<number | null> {
	const links = await db.query.profile_version_extensions.findMany({
		where: eq(profile_version_extensions.extender_id, versionId)
	});
	return links[0]?.extended_id ?? null;
}

async function main() {
	const profile = await db.query.profiles.findFirst({
		where: eq(profiles.id, profileId),
		columns: { id: true, slug: true }
	});
	if (!profile) {
		console.error(`profile ${profileId} does not exist`);
		process.exit(1);
	}
	console.log(`\nprofile ${profileId} (${profile.slug})`);

	const jobId = await makeJob();
	const baseId = await makeLibraryVersion(`${SCRATCH}-base`);
	const otherBaseId = await makeLibraryVersion(`${SCRATCH}-other-base`);

	const [application] = await db
		.insert(applications)
		.values({
			profile_id: profileId,
			job_id: jobId,
			status: 'draft',
			date_created: new Date()
		})
		.returning({ id: applications.id });
	made.applicationId = application.id;

	console.log(`\nrun: build the version tailored to this job`);

	const first = await tailorVersionForApplication({
		profileId,
		applicationId: application.id,
		docType: 'resume',
		baseSlug: `${SCRATCH}-base`
	});
	made.versionIds.push(first.versionId);

	check(
		'the version is the application’s own',
		first.versionSlug === tailoredSlugFor(application.id),
		first.versionSlug
	);
	check('it decided something', first.decisions.length > 0, `${first.decisions.length} decisions`);
	console.log(
		`        ranked by ${first.ranker}; model ${first.modelReviewed ? 'reviewed' : 'did NOT review'}; ` +
			`target ${first.targetPages}p, rendered ${first.pages ?? 'unknown'}p`
	);

	const version = await db.query.profile_versions.findFirst({
		where: eq(profile_versions.id, first.versionId),
		columns: { application_id: true, status: true, slug: true }
	});
	check(
		'it is tied to the application, not to the library',
		version?.application_id === application.id
	);
	// It has to render — the applicant opens it, exports it and sends it. It
	// stays out of the library listings by application_id, not by status.
	check('and it is published', version?.status === 'published', version?.status);

	const stored = await overridesOf(first.versionId);
	check(
		'every decision was written',
		stored.length === first.decisions.length,
		`${stored.length} rows`
	);
	check(
		'all of them as this feature’s own',
		stored.every((r) => r.source === 'ai')
	);

	// The table is unique on (version_id, entity_type, entity_id) and the insert
	// carries no conflict clause: a selector emitting one entity twice throws
	// here and nowhere else.
	const refs = stored.map((r) => `${r.entity_type}:${r.entity_id}`);
	check('no entity was decided about twice', new Set(refs).size === refs.length);

	check(
		'the version extends the base it was given',
		(await extendedIdOf(first.versionId)) === baseId
	);

	// The review panel reads these back through a join; a decision whose item
	// cannot be named is dropped, so an empty result here would mean the run
	// decided about nothing anyone can see.
	const described = await describeOverrides(
		(await decisionsForVersion(first.versionId)).map((r) => ({
			id: r.id,
			entity_type: r.entity_type,
			entity_id: r.entity_id,
			action: r.action,
			reason: r.reason,
			sort: r.sort,
			source: r.source
		}))
	);
	check(
		'the decisions can be read back with their labels',
		described.length > 0,
		`${described.length} of ${stored.length} nameable`
	);

	console.log(`\nrerun: replace this feature’s work, and nothing else`);

	// A judgement made by hand, on an entity the run itself decided about — the
	// case that matters, because that is the row a rerun would otherwise
	// recreate as its own.
	const target = stored[0];
	await db.delete(profile_version_overrides).where(eq(profile_version_overrides.id, target.id));
	const [mine] = await db
		.insert(profile_version_overrides)
		.values({
			version_id: first.versionId,
			entity_type: target.entity_type,
			entity_id: target.entity_id,
			action: 'include',
			reason: 'you chose to show this',
			source: 'user',
			date_created: new Date(),
			date_updated: new Date()
		})
		.returning({ id: profile_version_overrides.id });

	const second = await tailorVersionForApplication({
		profileId,
		applicationId: application.id,
		docType: 'resume',
		baseSlug: `${SCRATCH}-base`
	});
	check('the rerun reused the same version', second.versionId === first.versionId);

	const afterRerun = await overridesOf(first.versionId);
	const survivor = afterRerun.find((r) => r.id === mine.id);
	check(
		'the applicant’s own decision survived, untouched',
		!!survivor && survivor.source === 'user' && survivor.action === 'include'
	);
	check(
		'and the run did not write its own row about that entity',
		afterRerun.filter(
			(r) => `${r.entity_type}:${r.entity_id}` === `${target.entity_type}:${target.entity_id}`
		).length === 1
	);
	const aiRows = afterRerun.filter((r) => r.source === 'ai');
	check(
		'while its own rows were replaced',
		aiRows.every((r) => !stored.some((old) => old.id === r.id)),
		`${aiRows.length} new AI rows`
	);
	check(
		'still no entity decided about twice',
		new Set(afterRerun.map((r) => `${r.entity_type}:${r.entity_id}`)).size === afterRerun.length
	);

	console.log(`\nrerun: against a different base`);

	const third = await tailorVersionForApplication({
		profileId,
		applicationId: application.id,
		docType: 'resume',
		baseSlug: `${SCRATCH}-other-base`
	});
	check('the same version again', third.versionId === first.versionId);
	// Without this the selection is computed against one document and rendered
	// against another.
	check('the extension moved with it', (await extendedIdOf(first.versionId)) === otherBaseId);
	check(
		'and there is only one link',
		(
			await db.query.profile_version_extensions.findMany({
				where: eq(profile_version_extensions.extender_id, first.versionId)
			})
		).length === 1
	);
}

async function cleanup() {
	if (made.versionIds.length > 0) {
		await db
			.delete(profile_version_overrides)
			.where(inArray(profile_version_overrides.version_id, made.versionIds));
		await db
			.delete(profile_version_extensions)
			.where(inArray(profile_version_extensions.extender_id, made.versionIds));
		await db.delete(profile_versions).where(inArray(profile_versions.id, made.versionIds));
	}
	if (made.applicationId) {
		await db.delete(applications).where(eq(applications.id, made.applicationId));
	}
	if (made.jobId) {
		await db.delete(jobs).where(eq(jobs.id, made.jobId));
	}

	const leftVersions = made.versionIds.length
		? await db.query.profile_versions.findMany({
				where: inArray(profile_versions.id, made.versionIds),
				columns: { id: true }
			})
		: [];
	const leftApplication = made.applicationId
		? await db.query.applications.findFirst({
				where: and(eq(applications.id, made.applicationId)),
				columns: { id: true }
			})
		: undefined;

	check(
		'cleanup left no scratch versions',
		leftVersions.length === 0,
		leftVersions.map((v) => v.id).join(', ')
	);
	check('cleanup left no scratch application or job', !leftApplication);
}

main()
	.catch((err) => {
		console.error('\nthrew:', err);
		failures++;
	})
	.then(cleanup)
	.catch((err) => {
		console.error('\ncleanup threw:', err);
		failures++;
	})
	.then(() => {
		console.log(`\n${failures === 0 ? 'all checks passed' : `${failures} check(s) FAILED`}\n`);
		process.exit(failures === 0 ? 0 : 1);
	});
