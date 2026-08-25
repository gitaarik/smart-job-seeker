#!/usr/bin/env npx tsx
/**
 * The file reaper, against a real database, end to end and self-cleaning.
 *
 * `files` has no owner column. Reachability is the only ownership signal it
 * has, and it is not exclusive — two records may point at one blob — so every
 * deletion in `$lib/server/uploads/reap.ts` is guarded by "and nothing else
 * points at this". The unit tests cover what that SQL says. What they cannot
 * cover is whether Postgres agrees:
 *
 *   - the guard is built by name from `pg_constraint`, so it is only correct
 *     while the catalog query returns the real reference list;
 *   - the ids bind one parameter each, because the tidier `= ANY($1::uuid[])`
 *     fails at runtime with `22P02` — an error naming neither this query nor
 *     the array, and one no mock can produce;
 *   - the min-age cutoff is the only thing standing between the orphan sweep
 *     and every upload currently in flight.
 *
 * So this creates its own files, references one of them, reaps, and checks the
 * rows and the bytes afterwards — then deletes everything it made. It is
 * re-runnable, and it never touches a row that was there before it started.
 *
 *   npx dotenvx run -f /app/.env -- npx tsx scripts/verify-orphan-reap.ts <profileId>
 *
 * or from cloud/: npm run db:verify-orphan-reap -- <profileId>
 */
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { eq, inArray, sql } from 'drizzle-orm';
import { db, queryRawDirect } from '$lib/server/db';
import { files, profile_exports, profiles, resume_templates } from '$lib/server/db/schema';
import {
	collectProfileFileRefs,
	DEFAULT_ORPHAN_MIN_AGE_DAYS,
	findOrphanedFiles,
	reapFileRefs
} from '$lib/server/uploads/reap';

const profileId = Number(process.argv[2]);
if (!Number.isInteger(profileId)) {
	console.error('usage: verify-orphan-reap.ts <profileId>');
	process.exit(1);
}

/** Everything this run created, so the finally block can undo all of it. */
const madeFileIds: string[] = [];
const madeExportIds: number[] = [];
const madeTemplateIds: number[] = [];
const madePaths: string[] = [];

let failures = 0;
function check(what: string, ok: boolean, detail: unknown = '') {
	console.log(`${ok ? '  ok  ' : ' FAIL '} ${what}${detail === '' ? '' : `  → ${detail}`}`);
	if (!ok) failures++;
}

const UPLOADS_DIR = 'uploads';

async function onDisk(relativePath: string): Promise<boolean> {
	try {
		await access(join(UPLOADS_DIR, relativePath));
		return true;
	} catch {
		return false;
	}
}

/** A real row with real bytes under it, tagged so a stray one is identifiable. */
async function makeFile(label: string): Promise<{ id: string; disk: string }> {
	const id = randomUUID();
	const disk = `verify-orphan-reap-${id}.bin`;
	await mkdir(join(UPLOADS_DIR, 'files'), { recursive: true });
	await writeFile(join(UPLOADS_DIR, 'files', disk), `scratch ${label}`);
	await db.insert(files).values({
		id,
		storage: 'local',
		filename_disk: disk,
		filename_download: `verify-orphan-reap-${label}.bin`,
		type: 'application/octet-stream',
		filesize: 16
	});
	madeFileIds.push(id);
	madePaths.push(`files/${disk}`);
	return { id, disk };
}

/** Point something at a file, the way a real export does. */
async function reference(fileId: string): Promise<number> {
	const [row] = await db
		.insert(profile_exports)
		.values({
			profile_id: profileId,
			file_id: fileId,
			file_type: 'pdf',
			export_type: 'verify-orphan-reap'
		})
		.returning({ id: profile_exports.id });
	madeExportIds.push(row.id);
	return row.id;
}

async function rowExists(id: string): Promise<boolean> {
	const found = await db.select({ id: files.id }).from(files).where(eq(files.id, id)).limit(1);
	return found.length > 0;
}

async function backdate(id: string, days: number): Promise<void> {
	await queryRawDirect(
		sql`UPDATE files SET created_on = now() - ${`${days} days`}::interval WHERE id = ${id}::uuid`
	);
}

async function main() {
	const profile = await db
		.select({ id: profiles.id })
		.from(profiles)
		.where(eq(profiles.id, profileId))
		.limit(1);
	if (profile.length === 0) {
		console.error(`profile ${profileId} does not exist`);
		process.exit(1);
	}

	console.log(`\nreap: a referenced file survives, an unreferenced one does not`);

	const kept = await makeFile('kept');
	const doomed = await makeFile('doomed');
	const exportId = await reference(kept.id);
	const mediaPath = `verify-orphan-reap-${randomUUID()}.bin`;
	await writeFile(join(UPLOADS_DIR, mediaPath), 'scratch media');
	madePaths.push(mediaPath);

	const first = await reapFileRefs({
		fileIds: [kept.id, doomed.id],
		mediaPaths: [mediaPath]
	});

	check(
		'one row deleted, one retained',
		first.filesDeleted === 1 && first.filesRetained === 1,
		JSON.stringify(first)
	);
	check('the referenced row is still there', await rowExists(kept.id));
	check('its bytes are still there', await onDisk(`files/${kept.disk}`));
	check('the unreferenced row is gone', !(await rowExists(doomed.id)));
	check('its bytes are gone', !(await onDisk(`files/${doomed.disk}`)));
	check('the *_path media is unlinked', first.mediaUnlinked === 1 && !(await onDisk(mediaPath)));
	check('nothing failed to unlink', first.failures.length === 0, JSON.stringify(first.failures));

	// The parameter binding the unit tests can only inspect: more than one id in
	// one call is where `= ANY($1::uuid[])` used to raise 22P02.
	check(
		'a multi-id delete reached Postgres at all',
		first.filesDeleted + first.filesRetained === 2
	);

	console.log(`\nreap: the same file, once the last reference is gone`);

	await db.delete(profile_exports).where(eq(profile_exports.id, exportId));
	madeExportIds.splice(madeExportIds.indexOf(exportId), 1);

	const second = await reapFileRefs({ fileIds: [kept.id], mediaPaths: [] });
	check(
		'now it is deleted',
		second.filesDeleted === 1 && second.filesRetained === 0,
		JSON.stringify(second)
	);
	check(
		'and its bytes are unlinked',
		second.blobsUnlinked === 1 && !(await onDisk(`files/${kept.disk}`))
	);

	console.log(`\ncollect: the profile's own files, and only those`);

	const collected = await makeFile('collected');
	await reference(collected.id);
	const refs = await collectProfileFileRefs(profileId);
	check('a referenced export is collected for its profile', refs.fileIds.includes(collected.id));
	check('the collect returns no duplicates', new Set(refs.fileIds).size === refs.fileIds.length);

	console.log(`\norphan scan: age is what separates litter from an upload in flight`);

	const fresh = await makeFile('fresh-orphan');
	const freshListed = (await findOrphanedFiles()).some((f) => f.id === fresh.id);
	// uploadFile() inserts the row and only then hands the id to its caller to
	// store; a row seconds old with nothing pointing at it is that gap, not litter.
	check(`a brand-new orphan is NOT listed (min age ${DEFAULT_ORPHAN_MIN_AGE_DAYS}d)`, !freshListed);

	await backdate(fresh.id, DEFAULT_ORPHAN_MIN_AGE_DAYS + 23);
	const aged = await findOrphanedFiles();
	const agedRow = aged.find((f) => f.id === fresh.id);
	check('once it is old enough, it is listed', !!agedRow);
	check(
		'its size came back as a number',
		typeof agedRow?.filesize === 'number',
		String(agedRow?.filesize)
	);
	check('its timestamp came back as a Date', agedRow?.createdOn instanceof Date);

	// The same age, but something points at it.
	const oldReferenced = await makeFile('old-referenced');
	await reference(oldReferenced.id);
	await backdate(oldReferenced.id, DEFAULT_ORPHAN_MIN_AGE_DAYS + 23);
	const listedNow = (await findOrphanedFiles()).map((f) => f.id);
	check(
		'an old file something still points at is NOT listed',
		!listedNow.includes(oldReferenced.id)
	);
	check('the scan respects a limit', (await findOrphanedFiles({ limit: 1 })).length <= 1);

	// A template names its assets in jsonb: no foreign key, so the catalog is
	// blind to it. This is the gap the 2026-08-23 sweep deleted the Citrus
	// assets through, and a mocked test cannot tell whether the ILIKE/regexp
	// SQL that closes it actually runs.
	console.log(`\nsoft references: a file only a template config names`);

	const asset = await makeFile('template-asset');
	const [template] = await db
		.insert(resume_templates)
		.values({
			profile_id: profileId,
			name: 'verify-orphan-reap',
			slug: `verify-orphan-reap-${asset.id.slice(0, 8)}`,
			config: { assets: { badge: asset.id } }
		})
		.returning({ id: resume_templates.id });
	madeTemplateIds.push(template.id);
	await backdate(asset.id, DEFAULT_ORPHAN_MIN_AGE_DAYS + 23);

	check(
		'an old file only a template config names is NOT listed',
		!(await findOrphanedFiles()).some((f) => f.id === asset.id)
	);
	const spared = await reapFileRefs({ fileIds: [asset.id], mediaPaths: [] });
	check(
		'and the reap retains it',
		spared.filesRetained === 1 && (await rowExists(asset.id)),
		JSON.stringify(spared)
	);
	check(
		'collect finds it through the config',
		(await collectProfileFileRefs(profileId)).fileIds.includes(asset.id)
	);

	// And the guard is built from the catalog, so it covers every FK, not a list
	// someone remembered to update.
	const fks = await queryRawDirect<{ tbl: string }>(sql`
		SELECT c.conrelid::regclass::text AS tbl
		  FROM pg_constraint c
		 WHERE c.contype = 'f' AND c.confrelid = 'files'::regclass
	`);
	check(
		`the catalog reports ${fks.length} tables referencing files`,
		fks.length > 0,
		fks.map((f) => f.tbl).join(', ')
	);
}

async function cleanup() {
	if (madeTemplateIds.length > 0) {
		await db.delete(resume_templates).where(inArray(resume_templates.id, madeTemplateIds));
	}
	if (madeExportIds.length > 0) {
		await db.delete(profile_exports).where(inArray(profile_exports.id, madeExportIds));
	}
	if (madeFileIds.length > 0) {
		await db.delete(files).where(inArray(files.id, madeFileIds));
	}
	// Unlink whatever this run created and the reap did not — the scratch files
	// the later cases only ever read. A failed run must leave nothing behind
	// either, so this is unconditional and the checks below read the state it
	// leaves, not the state it found.
	const { deleteUpload } = await import('$lib/server/uploads');
	for (const p of madePaths) {
		if (await onDisk(p)) await deleteUpload(p);
	}

	const leftRows = madeFileIds.length
		? await db.select({ id: files.id }).from(files).where(inArray(files.id, madeFileIds))
		: [];
	const leftBytes: string[] = [];
	for (const p of madePaths) {
		if (await onDisk(p)) leftBytes.push(p);
	}

	check(
		'cleanup left no scratch rows',
		leftRows.length === 0,
		leftRows.map((r) => r.id).join(', ')
	);
	check('cleanup left no scratch bytes', leftBytes.length === 0, leftBytes.join(', '));
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
