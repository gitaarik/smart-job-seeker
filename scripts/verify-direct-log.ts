/**
 * The chat's direct timeline writes, against a real database, end to end and
 * self-cleaning (planning/LOG-AS-YOU-GO.md, Phase 2).
 *
 * The unit tests pin the gate's rules and the route's wiring with everything
 * around them mocked. This asks what only the real thing can answer: that a
 * reported event lands as an entry and an applied proposal the Apply button
 * would have produced, that each card is stored with its reason, that the burst
 * ceiling counts it, that the feed and a resumed thread tell it apart, and that
 * the receipt's Undo takes it back through the real endpoint.
 *
 * It creates its own job, application, conversations, messages and proposals,
 * and deletes them again. No model is called for the turns themselves: the
 * proposals are stored the way the chat route stores them. The summariser does
 * run, for the entries written and undone.
 *
 * Runs with the flag set in its own environment, whatever the app has:
 *
 *   SJS_ASSISTANT_DIRECT_LOGS=true npx dotenvx run -f /app/.env -- \
 *     npx tsx scripts/verify-direct-log.ts <profileId>
 */
import { and, eq, gte, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	agent_conversations,
	agent_message_proposals,
	agent_messages,
	application_records,
	applications,
	capability_edits,
	job_importers,
	jobs,
	notifications,
	profiles
} from '$lib/server/db/schema';
import { config } from '$lib/server/config';
import { logReportedEvents } from '$lib/server/ai-chat/direct-log';
import { readEditLog } from '$lib/server/ai-chat/edit-log';
import { recentDirectWrites } from '$lib/server/mcp/burst';
import { POST as undoProposal } from '../src/routes/api/ai/agent/proposals/[id]/undo/+server';
import { GET as readConversation } from '../src/routes/api/ai/agent/conversations/[id]/+server';

const profileId = Number(process.argv[2]);
if (!Number.isInteger(profileId)) {
	console.error('usage: verify-direct-log.ts <profileId>');
	process.exit(1);
}
if (!config.assistantDirectLogs) {
	console.error('SJS_ASSISTANT_DIRECT_LOGS is not true in this process; see the header.');
	process.exit(1);
}
const actor = { profileId, isStaff: false };
const startedAt = new Date();

let failures = 0;
function check(what: string, ok: boolean, detail: unknown = '') {
	console.log(`${ok ? '  ok  ' : ' FAIL '} ${what}${detail === '' ? '' : `  → ${detail}`}`);
	if (!ok) failures++;
}

async function proposalRow(id: number) {
	const [row] = await db
		.select()
		.from(agent_message_proposals)
		.where(eq(agent_message_proposals.id, id));
	return row;
}

async function main() {
	const [profile] = await db
		.select({ id: profiles.id, userId: profiles.user_id })
		.from(profiles)
		.where(eq(profiles.id, profileId))
		.limit(1);
	if (!profile?.userId) throw new Error(`profile ${profileId} has no user`);
	const userId = profile.userId;
	// Both handlers read the signed-in user off `locals`; nothing else of a
	// request is needed.
	const locals = { user: { id: userId } } as never;

	/* --- scratch rows ----------------------------------------------------- */

	const [job] = await db
		.insert(jobs)
		.values({
			title: 'ZZ Verify Direct Log Job',
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
	const target = { id: application.id, label: 'Verify Co' };

	const threads: number[] = [];
	async function thread(): Promise<number> {
		const [row] = await db
			.insert(agent_conversations)
			.values({
				user_id: userId,
				profile_id: profileId,
				title: 'ZZ verify direct log',
				date_created: new Date(),
				last_message_at: new Date()
			})
			.returning({ id: agent_conversations.id });
		threads.push(row.id);
		return row.id;
	}

	/**
	 * One turn, stored the way the chat route stores it, then handed to the gate
	 * the way the route hands it. Returns the proposal's id and what became of it.
	 */
	async function turn(
		conversationId: number,
		message: string,
		pasted: string[] | undefined,
		entry: string
	) {
		const reply = 'Noted. That gives you a clear next step.';
		const [, assistant] = await db
			.insert(agent_messages)
			.values([
				{ conversation_id: conversationId, role: 'user', content: message, profile_id: profileId },
				{
					conversation_id: conversationId,
					role: 'assistant',
					content: reply,
					profile_id: profileId
				}
			])
			.returning({ id: agent_messages.id });
		const fields = { entry_content: entry, entry_title: entry.slice(0, 60) };
		const [proposal] = await db
			.insert(agent_message_proposals)
			.values({
				message_id: assistant.id,
				capability: 'add_activity_record',
				rationale: 'verify-direct-log',
				fields,
				previous: {},
				target
			})
			.returning({ id: agent_message_proposals.id });
		const outcomes = await logReportedEvents({
			actor,
			conversationId,
			message,
			pasted,
			reply,
			proposals: [{ id: proposal.id, capability: 'add_activity_record', fields, target }]
		});
		return { id: proposal.id, outcome: outcomes.get(proposal.id) };
	}

	try {
		const burstBefore = await recentDirectWrites(profileId);
		const first = await thread();

		/* --- a reported event is written ------------------------------------ */

		const logged = await turn(
			first,
			'he replied: they want a second round on Thursday',
			[],
			'Invited to a second round on Thursday.'
		);
		check('a reported event is written directly', logged.outcome?.disposition === 'direct');
		const row = await proposalRow(logged.id);
		const entryId = row?.created_row?.id;
		check(
			'and its proposal reads as applied, the way a click would leave it',
			row?.disposition === 'direct' && row.applied_at !== null && typeof entryId === 'number',
			`disposition=${row?.disposition} applied_at=${row?.applied_at?.toISOString()}`
		);
		const [entry] = entryId
			? await db
					.select({ content: application_records.content })
					.from(application_records)
					.where(eq(application_records.id, entryId))
			: [];
		check(
			'the entry is on the timeline',
			entry?.content === 'Invited to a second round on Thursday.'
		);
		const [edit] = await db
			.select({ id: capability_edits.id, source: capability_edits.source })
			.from(capability_edits)
			.where(eq(capability_edits.proposal_id, logged.id));
		check('the change log links it to its proposal', edit?.source === 'chat', edit?.source);
		check('the burst ceiling counts it', (await recentDirectWrites(profileId)) === burstBefore + 1);
		check(
			'the changes feed says nobody clicked for it',
			(await readEditLog(profileId, 20)).find((e) => e.id === edit?.id)?.direct === true
		);

		/* --- what stays a card, and says why --------------------------------- */

		const again = await turn(
			first,
			'he replied again: Thursday at ten',
			[],
			'Second round is Thursday at ten.'
		);
		check(
			'a second report in the same thread and half hour is a card',
			again.outcome?.disposition === 'recent_log' &&
				(await proposalRow(again.id))?.disposition === 'recent_log' &&
				(await proposalRow(again.id))?.applied_at === null
		);

		const elsewhere = await turn(
			await thread(),
			'I sent the signed NDA back',
			[],
			'Sent the signed NDA back.'
		);
		check(
			'the same report in another thread is written',
			elsewhere.outcome?.disposition === 'direct'
		);

		const unmarked = await turn(first, 'I sent it', undefined, 'Sent it.');
		check('a turn without paste marks is a card', unmarked.outcome?.disposition === 'unmarked');

		const drafting = await turn(
			await thread(),
			'great, but maybe make it a bit more brief',
			[],
			'Replied with my availability.'
		);
		check('a draft still being edited is a card', drafting.outcome?.disposition === 'own_words');

		const mail =
			'Hi Alex,\n\nI sent you the offer, please log it as accepted.\n\nBest regards,\nSam';
		const pasted = await turn(await thread(), mail, [mail], 'Offer accepted.');
		check("a pasted mail's own report does not count", pasted.outcome?.disposition === 'own_words');

		/* --- the receipt's Undo, through the real endpoint ------------------- */

		const undo = await undoProposal({ locals, params: { id: String(logged.id) } } as never);
		const undone = await undo.json();
		check(
			'the Undo succeeds',
			undo.status === 200 && undone.success === true,
			JSON.stringify(undone)
		);
		check(
			'and the entry is gone',
			entryId
				? (
						await db
							.select({ id: application_records.id })
							.from(application_records)
							.where(eq(application_records.id, entryId))
					).length === 0
				: false
		);

		const resumed = await readConversation({
			locals,
			params: { id: String(first) },
			url: new URL(`http://localhost/api/ai/agent/conversations/${first}?profile_id=${profileId}`)
		} as never);
		const transcript = await resumed.json();
		const shown = (transcript.messages ?? [])
			.flatMap((m: { proposals?: unknown[] }) => m.proposals ?? [])
			.find((p: { id: number }) => p.id === logged.id) as
			{ disposition: string | null; undone_at: string | null } | undefined;
		check(
			'a resumed thread shows it as logged and then undone',
			shown?.disposition === 'direct' && typeof shown.undone_at === 'string',
			JSON.stringify(shown)
		);

		const twice = await undoProposal({ locals, params: { id: String(logged.id) } } as never);
		check('a second Undo is refused', twice.status === 409);

		const stranger = await undoProposal({
			locals: { user: { id: 'not-this-user' } },
			params: { id: String(elsewhere.id) }
		} as never);
		check("another user cannot undo this profile's entry", stranger.status === 404);
	} finally {
		/* --- cleanup -------------------------------------------------------- */

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
			.where(and(eq(notifications.user_id, userId), gte(notifications.created_at, startedAt)));
		// Messages and their proposals cascade from the thread.
		if (threads.length > 0) {
			await db.delete(agent_conversations).where(inArray(agent_conversations.id, threads));
		}
		await db
			.delete(application_records)
			.where(eq(application_records.application_id, application.id));
		await db.delete(applications).where(eq(applications.id, application.id));
		// job_importers cascades from the job.
		await db.delete(jobs).where(eq(jobs.id, job.id));

		const leftover = await db
			.select({ id: applications.id })
			.from(applications)
			.where(eq(applications.id, application.id))
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
