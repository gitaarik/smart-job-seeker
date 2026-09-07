/**
 * The application-text tools against a real database, end to end and
 * self-cleaning.
 *
 * The unit tests mock every read these tools do, which is right for the logic
 * and useless for the half that is SQL: four tables, two different ownership
 * shapes, a story whose text is five columns joined at read time, and an
 * aggregate over each trail. A mock cannot disagree with itself.
 *
 * The property worth verifying against real rows is the one the whole design
 * rests on: **the write must not reach the text**. So every write here is
 * followed by a read of the committed column, checked to be exactly what it was
 * before.
 *
 * It creates its own job, application, letter, question, story and cheat sheet,
 * does everything to them, and deletes them again.
 *
 *   npx dotenvx run -f /app/.env -- npx tsx scripts/verify-mcp-texts.ts <profileId>
 */
import { and, asc, eq, gte, inArray, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	application_letters,
	application_questions,
	applications,
	capability_edits,
	capability_requests,
	cheat_sheet_versions,
	cheat_sheets,
	job_importers,
	jobs,
	letter_versions,
	mcp_keys,
	notifications,
	profiles,
	project_stories,
	question_versions,
	story_versions
} from '$lib/server/db/schema';
import { serializeStarMarkdown } from '$lib/interview/star';
import { listProfileTexts, readProfileText } from '$lib/server/texts/profile-texts';
import { callTool } from '$lib/server/mcp/call';
import { createMcpKey } from '$lib/server/mcp/keys';
import { toolsFor } from '$lib/server/mcp/tools';
import type { VerifiedMcpKey } from '$lib/server/mcp/keys';

const profileId = Number(process.argv[2]);
if (!Number.isInteger(profileId)) {
	console.error('usage: verify-mcp-texts.ts <profileId>');
	process.exit(1);
}
const startedAt = new Date();

let failures = 0;
function check(what: string, ok: boolean, detail: unknown = '') {
	console.log(`${ok ? '  ok  ' : ' FAIL '} ${what}${detail === '' ? '' : `  → ${detail}`}`);
	if (!ok) failures++;
}

function text(result: { content: { text: string }[] }): string {
	return result.content.map((part) => part.text).join('\n');
}

const LETTER_TEXT = 'Dear hiring manager,\n\nI shipped the importer in six weeks.';
const ANSWER_TEXT = 'Because the product is the reason I would get up for it.';
const SHEET_TEXT = '## Questions to ask\n- Who owns the roadmap?';
const STORY = {
	situation: 'The importer was slow.',
	task: 'Make it fast.',
	action: 'I profiled it.'
};

async function main() {
	const [profile] = await db
		.select({ id: profiles.id, userId: profiles.user_id })
		.from(profiles)
		.where(eq(profiles.id, profileId))
		.limit(1);
	if (!profile?.userId) throw new Error(`profile ${profileId} has no user`);

	/* --- scratch rows ----------------------------------------------------- */

	const [job] = await db
		.insert(jobs)
		.values({
			title: 'ZZ Verify Texts Job',
			company: 'Verify Co',
			status: 'draft',
			created_manually: true,
			date_created: new Date(),
			date_updated: new Date()
		})
		.returning({ id: jobs.id });
	await db.insert(job_importers).values({ job_id: job.id, profile_id: profileId });

	const [application] = await db
		.insert(applications)
		.values({
			profile_id: profileId,
			job_id: job.id,
			status: 'draft',
			date_created: new Date(),
			date_updated: new Date()
		})
		.returning({ id: applications.id });

	const [letter] = await db
		.insert(application_letters)
		.values({
			application_id: application.id,
			letter_type: 'cover_letter',
			content: LETTER_TEXT,
			status: 'draft',
			date_created: new Date()
		})
		.returning({ id: application_letters.id });

	const [question] = await db
		.insert(application_questions)
		.values({
			application_id: application.id,
			question: 'Why do you want to work here?',
			answer: ANSWER_TEXT,
			date_created: new Date()
		})
		.returning({ id: application_questions.id });

	const [story] = await db
		.insert(project_stories)
		.values({
			profile_id: profileId,
			title: 'ZZ Verify Story',
			...STORY,
			date_created: new Date()
		})
		.returning({ id: project_stories.id });

	const [sheet] = await db
		.insert(cheat_sheets)
		.values({
			profile_id: profileId,
			title: 'ZZ Verify Sheet',
			content: SHEET_TEXT,
			date_created: new Date()
		})
		.returning({ id: cheat_sheets.id });

	const minted = await createMcpKey({
		userId: profile.userId,
		profileId,
		name: 'ZZ Verify Texts Key',
		scope: 'write',
		readScope: 'record'
	});
	if (!minted) throw new Error('could not mint a key for this profile');

	const KEY: VerifiedMcpKey = {
		keyId: minted.id,
		userId: profile.userId,
		profileId,
		scope: 'write',
		// The NARROW end on purpose: these are the applicant's own words, so they
		// must be reachable without the documents dimension.
		readScope: 'record',
		name: 'ZZ Verify Texts Key'
	};

	try {
		/* --- the tool surface --------------------------------------------- */

		const names = new Set((await toolsFor('write')).map((tool) => tool.name));
		check(
			'the text tools are listed',
			[
				'list_texts',
				'read_text',
				'add_letter_version',
				'add_question_version',
				'add_story_version',
				'add_cheat_sheet_version'
			].every((name) => names.has(name))
		);

		/* --- reads ---------------------------------------------------------- */

		const all = await callTool('list_texts', { profile_id: profileId }, KEY);
		const listed = text(all);
		check(
			'all four kinds are listed',
			[
				`[letter ${letter.id}]`,
				`[question ${question.id}]`,
				`[story ${story.id}]`,
				`[cheat_sheet ${sheet.id}]`
			].every((needle) => listed.includes(needle))
		);

		const onApplication = text(
			await callTool('list_texts', { profile_id: profileId, application_id: application.id }, KEY)
		);
		check(
			'an application names its letter and its question',
			onApplication.includes(`[letter ${letter.id}]`) &&
				onApplication.includes(`[question ${question.id}]`)
		);
		check(
			'and nothing that belongs to the profile instead',
			!onApplication.includes(`[story ${story.id}]`) &&
				!onApplication.includes(`[cheat_sheet ${sheet.id}]`)
		);

		const oneKind = text(
			await callTool('list_texts', { profile_id: profileId, kind: 'story' }, KEY)
		);
		check(
			'a kind filter returns only that kind',
			oneKind.includes(`[story ${story.id}]`) && !oneKind.includes(`[letter ${letter.id}]`)
		);

		const readLetter = await callTool(
			'read_text',
			{ profile_id: profileId, kind: 'letter', text_id: letter.id },
			KEY
		);
		check('read_text returns the letter', text(readLetter).includes('shipped the importer'));

		const readQuestion = text(
			await callTool(
				'read_text',
				{ profile_id: profileId, kind: 'question', text_id: question.id },
				KEY
			)
		);
		check(
			'an answer comes back with the question it answers',
			readQuestion.includes('Why do you want to work here?') &&
				readQuestion.includes('get up for it')
		);

		const readStory = text(
			await callTool('read_text', { profile_id: profileId, kind: 'story', text_id: story.id }, KEY)
		);
		check(
			'a story is assembled from its columns as STAR markdown',
			readStory.includes('## Situation') && readStory.includes('The importer was slow.')
		);

		/* --- the scope ------------------------------------------------------ */

		const wrongKind = await callTool(
			'read_text',
			{ profile_id: profileId, kind: 'story', text_id: letter.id },
			KEY
		);
		check(
			'a letter id used as a story id reaches nothing',
			wrongKind.isError === true,
			text(wrongKind).slice(0, 60)
		);

		const [other] = await db
			.select({ id: profiles.id })
			.from(profiles)
			.where(sql`${profiles.id} <> ${profileId}`)
			.limit(1);
		if (other) {
			check(
				'another profile cannot read this letter',
				(await readProfileText('letter', letter.id, other.id)) === null,
				`profile ${other.id}`
			);
			check(
				'another profile cannot read this story',
				(await readProfileText('story', story.id, other.id)) === null
			);
		} else {
			console.log('  --   only one profile exists, so cross-profile scope is untested');
		}

		/* --- the write, and what it must not touch -------------------------- */

		const wrote = await callTool(
			'add_letter_version',
			{
				profile_id: profileId,
				text_id: letter.id,
				letter_content: 'Dear hiring manager,\n\nI shipped the importer in six weeks, alone.',
				letter_note: 'Named that you did it alone.',
				rationale: 'They asked for something more specific.'
			},
			KEY
		);
		check('a version is written directly on a write key', wrote.isError === undefined);
		check(
			'and the result does not claim the letter changed',
			text(wrote).includes('has changed yet')
		);

		const [afterWrite] = await db
			.select({ content: application_letters.content })
			.from(application_letters)
			.where(eq(application_letters.id, letter.id));
		check(
			'THE LETTER ITSELF IS UNTOUCHED',
			afterWrite.content === LETTER_TEXT,
			afterWrite.content === LETTER_TEXT ? '' : `became ${JSON.stringify(afterWrite.content)}`
		);

		const trail = await db
			.select({ source: letter_versions.source, content: letter_versions.content })
			.from(letter_versions)
			.where(eq(letter_versions.letter, letter.id))
			.orderBy(asc(letter_versions.id));
		check(
			'the applicant’s original is kept as the baseline first',
			trail.length === 2 && trail[0].source === 'manual_edit' && trail[0].content === LETTER_TEXT,
			trail.map((v) => v.source).join(' → ')
		);
		check(
			'and the new version is labelled as an agent’s',
			trail[1]?.source === 'agent_revision' && (trail[1]?.content ?? '').includes('alone')
		);

		const nowWaiting = text(
			await callTool('list_texts', { profile_id: profileId, kind: 'letter' }, KEY)
		);
		check('the list now says a version is waiting', nowWaiting.includes('NOT taken yet'));

		const again = await callTool(
			'add_letter_version',
			{
				profile_id: profileId,
				text_id: letter.id,
				letter_content: 'Dear hiring manager,\n\nI shipped the importer in six weeks, alone.',
				rationale: 'the same thing again'
			},
			KEY
		);
		check('the same text again is refused', again.isError === true, text(again).slice(0, 60));

		/* --- a story writes markdown and leaves the columns alone ----------- */

		const wroteStory = await callTool(
			'add_story_version',
			{
				profile_id: profileId,
				text_id: story.id,
				story_content:
					'Situation:\nThe importer was slow.\n\nTask:\nMake it fast.\n\nResult:\nIt was.',
				story_note: 'Added the result.',
				rationale: 'The story stopped before the outcome.'
			},
			KEY
		);
		check(
			'a story version is written',
			wroteStory.isError === undefined,
			text(wroteStory).slice(0, 80)
		);

		const [afterStory] = await db
			.select({
				situation: project_stories.situation,
				task: project_stories.task,
				action: project_stories.action,
				result: project_stories.result
			})
			.from(project_stories)
			.where(eq(project_stories.id, story.id));
		check(
			'THE STORY’S OWN COLUMNS ARE UNTOUCHED',
			afterStory.situation === STORY.situation &&
				afterStory.action === STORY.action &&
				afterStory.result === null
		);

		const storyTrail = await db
			.select({ content: story_versions.content, source: story_versions.source })
			.from(story_versions)
			.where(eq(story_versions.story, story.id))
			.orderBy(asc(story_versions.id));
		check(
			'the baseline is the story as its columns had it',
			storyTrail[0]?.content === serializeStarMarkdown(STORY)
		);
		check(
			'and the version is canonical STAR markdown, not what was sent',
			storyTrail[1]?.content ===
				serializeStarMarkdown({
					situation: STORY.situation,
					task: 'Make it fast.',
					result: 'It was.'
				}),
			JSON.stringify(storyTrail[1]?.content?.slice(0, 60))
		);

		/* --- the reader agrees with the tools ------------------------------- */

		const summaries = await listProfileTexts(profileId, { kind: 'letter', limit: 50 });
		const summary = summaries.find((row) => row.id === letter.id);
		check(
			'the reader reports the waiting version rather than the saved letter',
			summary?.latest_is_current === false && summary?.versions === 2,
			`${summary?.versions} versions`
		);
		check(
			'and points at the page it is waiting on',
			summary?.path === `/applications/${application.id}/texts/${letter.id}`
		);
	} finally {
		/* --- cleanup -------------------------------------------------------- */

		const requests = await db
			.select({ id: capability_requests.id })
			.from(capability_requests)
			.where(
				and(
					eq(capability_requests.profile_id, profileId),
					gte(capability_requests.date_created, startedAt)
				)
			);
		if (requests.length > 0) {
			await db.delete(capability_requests).where(
				inArray(
					capability_requests.id,
					requests.map((r) => r.id)
				)
			);
		}
		await db
			.delete(capability_edits)
			.where(
				and(
					eq(capability_edits.profile_id, profileId),
					gte(capability_edits.date_created, startedAt)
				)
			);
		await db
			.delete(notifications)
			.where(
				and(eq(notifications.user_id, profile.userId), gte(notifications.created_at, startedAt))
			);

		// The version trails cascade from their entities, and the letter and the
		// question cascade from the application — deleted explicitly anyway, so a
		// missing cascade shows up here rather than as rows nobody looks at.
		await db.delete(letter_versions).where(eq(letter_versions.letter, letter.id));
		await db.delete(question_versions).where(eq(question_versions.question, question.id));
		await db.delete(story_versions).where(eq(story_versions.story, story.id));
		await db.delete(cheat_sheet_versions).where(eq(cheat_sheet_versions.cheat_sheet, sheet.id));
		await db.delete(application_letters).where(eq(application_letters.id, letter.id));
		await db.delete(application_questions).where(eq(application_questions.id, question.id));
		await db.delete(project_stories).where(eq(project_stories.id, story.id));
		await db.delete(cheat_sheets).where(eq(cheat_sheets.id, sheet.id));
		await db.delete(applications).where(eq(applications.id, application.id));
		await db.delete(jobs).where(eq(jobs.id, job.id));
		await db.delete(mcp_keys).where(eq(mcp_keys.id, minted.id));

		const leftover = await db
			.select({ id: application_letters.id })
			.from(application_letters)
			.where(eq(application_letters.id, letter.id))
			.limit(1);
		check('the scratch rows are gone', leftover.length === 0);
	}

	console.log(failures === 0 ? '\nall checks passed' : `\n${failures} FAILED`);
	process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
