/**
 * Translation fields against a real database, end to end and self-cleaning.
 *
 * The unit tests stand in for the overlay's reads and writes, which is the right
 * trade for the refusals and the wrong one for what this asks: that a Dutch field
 * sent to a tool lands in `profile_translations` under the key the renderers
 * read, that the change log's before-image puts it back, and that undoing an add
 * takes its translations with the row — three answers written in three modules.
 *
 * It makes its own references, gives one of them a Dutch position so the profile
 * writes in Dutch, does everything to them, and deletes them again. Nothing that
 * was there before it started is read for more than its languages or written at
 * all.
 *
 *   npx dotenvx run -f /app/.env -- npx tsx scripts/verify-mcp-translations.ts <profileId>
 */
import { and, eq, gte, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	capability_edits,
	capability_requests,
	mcp_keys,
	notifications,
	profile_translations,
	profiles,
	references
} from '$lib/server/db/schema';
import { revertEdit } from '$lib/server/ai-chat/edit-log';
import {
	buildProposalSchema,
	liveLanguages,
	renderCapabilityPrompt,
	resolveCapabilities
} from '$lib/server/ai-chat/capabilities';
import { callTool } from '$lib/server/mcp/call';
import { createMcpKey, type VerifiedMcpKey } from '$lib/server/mcp/keys';
import { approveRequest } from '$lib/server/mcp/requests';
import { toolsFor } from '$lib/server/mcp/tools';
import { createRow } from '$lib/server/profile/write';
import { translatedLocales, writeTranslations } from '$lib/server/profile/section-translations';
import { TRANSLATION_LOCALES } from '$lib/resume-translations';

const profileId = Number(process.argv[2]);
if (!Number.isInteger(profileId)) {
	console.error('usage: verify-mcp-translations.ts <profileId>');
	process.exit(1);
}
const actor = { profileId, isStaff: false };
const startedAt = new Date();

let failures = 0;
function check(what: string, ok: boolean, detail: unknown = '') {
	console.log(`${ok ? '  ok  ' : ' FAIL '} ${what}${detail === '' ? '' : `  → ${detail}`}`);
	if (!ok) failures++;
}

function text(result: { content: { text: string }[] }): string {
	return result.content.map((part) => part.text).join('\n');
}

/** One reference's translations, as the renderers would look them up. */
async function dutch(id: number): Promise<Record<string, string>> {
	const rows = await db
		.select({ field: profile_translations.field, value: profile_translations.value })
		.from(profile_translations)
		.where(
			and(
				eq(profile_translations.profile_id, profileId),
				eq(profile_translations.entity_type, 'reference'),
				eq(profile_translations.entity_id, id),
				eq(profile_translations.locale, 'nl')
			)
		);
	return Object.fromEntries(rows.map((row) => [row.field, row.value]));
}

async function reference(id: number) {
	const [row] = await db.select().from(references).where(eq(references.id, id)).limit(1);
	return row ?? null;
}

async function main() {
	const [profile] = await db
		.select({ id: profiles.id, userId: profiles.user_id })
		.from(profiles)
		.where(eq(profiles.id, profileId))
		.limit(1);
	if (!profile?.userId) throw new Error(`profile ${profileId} has no user`);

	/* --- scratch rows ----------------------------------------------------- */

	const made = await createRow(
		'reference',
		{ profileId },
		{
			author: 'ZZ Verify Referee',
			author_position: 'Scratch lead',
			text: 'A scratch reference, made to be translated.'
		}
	);
	if (!made.ok) throw new Error(made.error);
	const scratch = made.id;
	const added: number[] = [];

	// The Dutch position is what makes this a profile that writes in Dutch, if it
	// was not one already.
	await writeTranslations(profileId, 'reference', scratch, {
		'reference.author_position.nl': 'Kladleider'
	});

	const minted = await createMcpKey({
		userId: profile.userId,
		profileId,
		name: 'ZZ verify-mcp-translations',
		scope: 'write',
		readScope: 'documents'
	});
	if (!minted) throw new Error('could not mint a key for this profile');
	const KEY: VerifiedMcpKey = {
		keyId: minted.id,
		userId: profile.userId,
		profileId,
		scope: 'write',
		readScope: 'documents',
		name: 'ZZ verify-mcp-translations'
	};

	try {
		const languages = await translatedLocales(profileId);
		const unstarted = TRANSLATION_LOCALES.find((locale) => !languages.includes(locale));
		console.log(`profile ${profileId} writes in: ${languages.join(', ')}\n`);

		/* --- what an agent is shown ----------------------------------------- */

		const tools = await toolsFor('write', 'documents', { profileId });
		const editReference = tools.find((tool) => tool.name === 'edit_reference');
		const properties = Object.keys(editReference?.inputSchema.properties ?? {});
		check('the tool lists the Dutch fields', properties.includes('reference.text.nl'));
		if (unstarted) {
			check(
				`and not a language the profile has not started (${unstarted})`,
				!properties.includes(`reference.text.${unstarted}`)
			);
		}

		const read = await callTool(
			'read_profile_section',
			{ profile_id: profileId, section: 'reference' },
			KEY
		);
		const entry = (
			read.structuredContent?.entries as { entry_id: number; fields: Record<string, unknown> }[]
		).find((e) => e.entry_id === scratch);
		check(
			'the read shows the Dutch beside the English',
			entry?.fields['reference.author_position.nl'] === 'Kladleider' &&
				entry?.fields['reference.text.nl'] === null,
			JSON.stringify(entry?.fields)
		);

		/* --- filling one is a direct write, and undoes ---------------------- */

		const fill = await callTool(
			'edit_reference',
			{
				profile_id: profileId,
				entry_id: scratch,
				'reference.text.nl': 'Een kladreferentie, gemaakt om vertaald te worden.',
				rationale: 'verify: fill an empty translation'
			},
			KEY
		);
		check(
			'filling an empty translation applies directly',
			fill.structuredContent?.applied === true,
			text(fill)
		);
		check(
			'and lands where the renderers read it',
			(await dutch(scratch)).text === 'Een kladreferentie, gemaakt om vertaald te worden.'
		);

		const undoFill = await revertEdit(Number(fill.structuredContent?.change_id), actor);
		check('undoing it succeeds', undoFill.ok, JSON.stringify(undoFill));
		check('and removes the translation it added', (await dutch(scratch)).text === undefined);

		/* --- an English change that leaves the Dutch behind ----------------- */

		const english = await callTool(
			'edit_reference',
			{
				profile_id: profileId,
				entry_id: scratch,
				'reference.author_position': 'Scratch director',
				rationale: 'verify: English only'
			},
			KEY
		);
		check('replacing English asks, as before', english.structuredContent?.applied === false);
		check(
			'and says the Dutch would go stale',
			JSON.stringify(english.structuredContent?.stale_translations) ===
				JSON.stringify(['reference.author_position.nl']),
			text(english)
		);
		if (english.structuredContent?.request_id) {
			await db
				.update(capability_requests)
				.set({ status: 'rejected', decided_at: new Date() })
				.where(eq(capability_requests.id, Number(english.structuredContent.request_id)));
		}

		/* --- both, approved together, undone together ----------------------- */

		const both = await callTool(
			'edit_reference',
			{
				profile_id: profileId,
				entry_id: scratch,
				'reference.author_position': 'Scratch director',
				'reference.author_position.nl': 'Kladdirecteur',
				rationale: 'verify: English and Dutch together'
			},
			KEY
		);
		check(
			'a change to both is one request with no warning',
			both.structuredContent?.applied === false &&
				both.structuredContent?.stale_translations === undefined
		);

		const approved = await approveRequest(Number(both.structuredContent?.request_id), actor);
		check('approving it applies', approved.ok, JSON.stringify(approved));
		check(
			'both languages changed',
			(await reference(scratch))?.author_position === 'Scratch director' &&
				(await dutch(scratch)).author_position === 'Kladdirecteur'
		);

		const [bothEdit] = await db
			.select({ id: capability_edits.id })
			.from(capability_edits)
			.where(
				and(
					eq(capability_edits.profile_id, profileId),
					eq(capability_edits.capability, 'edit_reference'),
					gte(capability_edits.date_created, startedAt)
				)
			)
			.orderBy(capability_edits.id)
			.limit(10)
			.then((rows) => rows.slice(-1));
		const undoBoth = await revertEdit(bothEdit.id, actor);
		check('undoing the pair succeeds', undoBoth.ok, JSON.stringify(undoBoth));
		check(
			'and puts both back',
			(await reference(scratch))?.author_position === 'Scratch lead' &&
				(await dutch(scratch)).author_position === 'Kladleider'
		);

		/* --- refusals -------------------------------------------------------- */

		if (unstarted) {
			const foreign = await callTool(
				'edit_reference',
				{
					profile_id: profileId,
					entry_id: scratch,
					[`reference.text.${unstarted}`]: 'x',
					rationale: 'verify: a language nobody started'
				},
				KEY
			);
			check(
				'a language the profile has not started is refused',
				foreign.isError === true,
				text(foreign)
			);
		}

		const cleared = await callTool(
			'edit_reference',
			{
				profile_id: profileId,
				entry_id: scratch,
				'reference.author_position': null,
				rationale: 'verify: clear the English under its Dutch'
			},
			KEY
		);
		check('clearing English under its Dutch is refused', cleared.isError === true, text(cleared));

		/* --- an add brings its Dutch, and its undo takes it ------------------ */

		const add = await callTool(
			'add_reference',
			{
				profile_id: profileId,
				'reference.author': 'ZZ Verify Added Referee',
				'reference.text': 'Added with its Dutch.',
				'reference.text.nl': 'Toegevoegd met het Nederlands.',
				rationale: 'verify: add with a translation'
			},
			KEY
		);
		check(
			'an add with a translation applies directly',
			add.structuredContent?.applied === true,
			text(add)
		);
		const [addedRow] = await db
			.select({ id: references.id, created: references.date_created })
			.from(references)
			.where(
				and(eq(references.profile_id, profileId), eq(references.author, 'ZZ Verify Added Referee'))
			);
		if (addedRow) added.push(addedRow.id);
		check(
			'the row exists with its Dutch',
			(await dutch(addedRow?.id ?? -1)).text === 'Toegevoegd met het Nederlands.'
		);

		const [stamp] = await db
			.select({
				created: profile_translations.date_created,
				updated: profile_translations.date_updated
			})
			.from(profile_translations)
			.where(
				and(
					eq(profile_translations.entity_type, 'reference'),
					eq(profile_translations.entity_id, addedRow?.id ?? -1)
				)
			);
		check(
			'stamped with the row’s own creation',
			stamp?.created?.getTime() === addedRow?.created?.getTime() &&
				stamp?.updated?.getTime() === addedRow?.created?.getTime(),
			`${stamp?.created?.toISOString()} vs ${addedRow?.created?.toISOString()}`
		);

		const undoAdd = await revertEdit(Number(add.structuredContent?.change_id), actor);
		check('undoing the add succeeds', undoAdd.ok, JSON.stringify(undoAdd));
		check(
			'and takes the translation with the row',
			(await reference(addedRow?.id ?? -1)) === null &&
				Object.keys(await dutch(addedRow?.id ?? -1)).length === 0
		);

		const again = await callTool(
			'add_reference',
			{
				profile_id: profileId,
				'reference.author': 'ZZ Verify Added Referee',
				'reference.text': 'Added with its Dutch.',
				'reference.text.nl': 'Toegevoegd met het Nederlands.',
				rationale: 'verify: add, then a Dutch line by hand'
			},
			KEY
		);
		const [againRow] = await db
			.select({ id: references.id })
			.from(references)
			.where(
				and(eq(references.profile_id, profileId), eq(references.author, 'ZZ Verify Added Referee'))
			);
		if (againRow) added.push(againRow.id);
		await new Promise((resolve) => setTimeout(resolve, 5));
		await writeTranslations(profileId, 'reference', againRow.id, {
			'reference.text.nl': 'Met de hand herschreven.'
		});
		const refusedUndo = await revertEdit(Number(again.structuredContent?.change_id), actor);
		check(
			'an add whose Dutch was rewritten since is not undone',
			!refusedUndo.ok && (await reference(againRow.id)) !== null,
			JSON.stringify(refusedUndo)
		);

		/* --- the chat, on the references page ------------------------------- */

		const live = await resolveCapabilities(['edit_reference', 'add_reference'], null, actor);
		const edit = live.find((c) => c.capability === 'edit_reference');
		check('the chat is offered Dutch', liveLanguages(live).includes('nl'));
		check(
			'and told which listed row has it',
			edit?.notes?.[scratch] === 'Dutch: author_position',
			JSON.stringify(edit?.notes)
		);
		check(
			'the prompt carries the rule once',
			(renderCapabilityPrompt(live).match(/Their CV also exists in/g) ?? []).length === 1
		);
		const schema = buildProposalSchema(
			live.map((c) => c.capability),
			{ languages: liveLanguages(live) }
		);
		check(
			'and the schema takes a Dutch field',
			schema.safeParse({
				reply: 'x',
				proposals: [
					{
						capability: 'edit_reference',
						target_id: scratch,
						rationale: 'x',
						changes: [{ field: 'reference.text.nl', value: 'x' }]
					}
				]
			}).success
		);
	} finally {
		/* --- cleanup -------------------------------------------------------- */

		const ids = [scratch, ...added];
		await db
			.delete(profile_translations)
			.where(
				and(
					eq(profile_translations.profile_id, profileId),
					eq(profile_translations.entity_type, 'reference'),
					inArray(profile_translations.entity_id, ids)
				)
			);
		await db.delete(references).where(inArray(references.id, ids));
		await db.delete(capability_requests).where(eq(capability_requests.mcp_key_id, minted.id));
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
		await db.delete(mcp_keys).where(eq(mcp_keys.id, minted.id));

		const leftover = await db
			.select({ id: references.id })
			.from(references)
			.where(inArray(references.id, ids));
		check('the scratch rows are gone', leftover.length === 0);
	}

	console.log(failures === 0 ? '\nall checks passed' : `\n${failures} FAILED`);
	process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
