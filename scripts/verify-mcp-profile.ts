/**
 * `edit_profile` against a real database, end to end and self-cleaning.
 *
 * The unit tests stand in for the profile row and the overlay. What this asks
 * is what they cannot: that a text sent to the tool lands in the column the CV
 * prints and Basic Info edits, that its Dutch lands under the key the renderers
 * read (entity `profile`, the profile's own id), that the history describes it,
 * and that the change log's before-image puts both back.
 *
 * It works on the profile's own row, which it cannot make a scratch copy of. So
 * it records the five texts and their translations first, sets known values to
 * work against, and writes the recorded ones back at the end whatever happened
 * in between. Run it on a test profile.
 *
 *   npx dotenvx run -f /app/.env -- npx tsx scripts/verify-mcp-profile.ts <profileId>
 */
import { and, eq, gte, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	capability_edits,
	capability_requests,
	mcp_keys,
	notifications,
	profile_translations,
	profiles
} from '$lib/server/db/schema';
import { describeLoggedChange, readEditLog, revertEdit } from '$lib/server/ai-chat/edit-log';
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
import { BASIC_INFO_COLUMNS, type BasicInfo } from '$lib/server/profile/basic-info';

const profileId = Number(process.argv[2]);
if (!Number.isInteger(profileId)) {
	console.error('usage: verify-mcp-profile.ts <profileId>');
	process.exit(1);
}
const actor = { profileId, isStaff: false };
const startedAt = new Date();
const COLUMNS = [...BASIC_INFO_COLUMNS];

let failures = 0;
function check(what: string, ok: boolean, detail: unknown = '') {
	console.log(`${ok ? '  ok  ' : ' FAIL '} ${what}${detail === '' ? '' : `  → ${detail}`}`);
	if (!ok) failures++;
}

function text(result: { content: { text: string }[] }): string {
	return result.content.map((part) => part.text).join('\n');
}

async function texts(): Promise<BasicInfo> {
	const [row] = await db
		.select({
			title: profiles.title,
			subtitle: profiles.subtitle,
			headline: profiles.headline,
			summary: profiles.summary,
			about_me_text: profiles.about_me_text
		})
		.from(profiles)
		.where(eq(profiles.id, profileId));
	return row;
}

/** The row's translations, every language, as stored. */
async function overlay() {
	return db
		.select()
		.from(profile_translations)
		.where(
			and(
				eq(profile_translations.profile_id, profileId),
				eq(profile_translations.entity_type, 'profile'),
				eq(profile_translations.entity_id, profileId),
				inArray(profile_translations.field, COLUMNS)
			)
		);
}

/** The row's Dutch, by column, as the renderers would look it up. */
async function dutch(): Promise<Record<string, string>> {
	return Object.fromEntries(
		(await overlay()).filter((row) => row.locale === 'nl').map((row) => [row.field, row.value])
	);
}

async function setDutch(field: string, value: string) {
	const now = new Date();
	await db
		.insert(profile_translations)
		.values({
			profile_id: profileId,
			entity_type: 'profile',
			entity_id: profileId,
			field,
			locale: 'nl',
			value,
			date_created: now,
			date_updated: now
		})
		.onConflictDoUpdate({
			target: [
				profile_translations.profile_id,
				profile_translations.entity_type,
				profile_translations.entity_id,
				profile_translations.field,
				profile_translations.locale
			],
			set: { value, date_updated: now }
		});
}

async function rejectRequest(id: unknown) {
	if (!id) return;
	await db
		.update(capability_requests)
		.set({ status: 'rejected', decided_at: new Date() })
		.where(eq(capability_requests.id, Number(id)));
}

/** The newest logged edit_profile change from this run. */
async function lastEditId(): Promise<number> {
	const rows = await db
		.select({ id: capability_edits.id })
		.from(capability_edits)
		.where(
			and(
				eq(capability_edits.profile_id, profileId),
				eq(capability_edits.capability, 'edit_profile'),
				gte(capability_edits.date_created, startedAt)
			)
		)
		.orderBy(capability_edits.id);
	return rows.at(-1)?.id ?? -1;
}

async function main() {
	const [profile] = await db
		.select({ id: profiles.id, userId: profiles.user_id })
		.from(profiles)
		.where(eq(profiles.id, profileId))
		.limit(1);
	if (!profile?.userId) throw new Error(`profile ${profileId} has no user`);

	const originalTexts = await texts();
	const originalOverlay = await overlay();

	const minted = await createMcpKey({
		userId: profile.userId,
		profileId,
		name: 'ZZ verify-mcp-profile',
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
		name: 'ZZ verify-mcp-profile'
	};

	try {
		/* --- known values to work against ----------------------------------- */

		// An empty subtitle for the direct write, and a Dutch summary, which is
		// also what makes this a profile that writes Dutch if it was not one.
		await db
			.update(profiles)
			.set({
				title: 'ZZ Verify Engineer',
				subtitle: null,
				headline: 'ZZ verify headline.',
				summary: 'ZZ verify summary.',
				about_me_text: 'ZZ verify bio.'
			})
			.where(eq(profiles.id, profileId));
		await db
			.delete(profile_translations)
			.where(
				and(
					eq(profile_translations.profile_id, profileId),
					eq(profile_translations.entity_type, 'profile'),
					eq(profile_translations.entity_id, profileId),
					inArray(profile_translations.field, COLUMNS)
				)
			);
		await setDutch('summary', 'ZZ verificatie samenvatting.');

		/* --- what an agent is shown ----------------------------------------- */

		const tools = await toolsFor('write', 'documents', { profileId });
		const tool = tools.find((t) => t.name === 'edit_profile');
		const properties = Object.keys(tool?.inputSchema.properties ?? {});
		check('the tool is offered', !!tool);
		check('it takes no entry_id', !properties.includes('entry_id'));
		check('it lists the Dutch of each text', properties.includes('profile.about_me_text.nl'));
		check('and not the email address', !properties.includes('profile.email_address'));

		const listed = await callTool('list_profile_sections', {}, KEY);
		const sections = listed.structuredContent?.sections as { section: string }[];
		check('list_profile_sections names it first', sections?.[0]?.section === 'profile');

		const read = await callTool(
			'read_profile_section',
			{ profile_id: profileId, section: 'profile' },
			KEY
		);
		const fields = (read.structuredContent?.entries as { fields: Record<string, unknown> }[])?.[0]
			?.fields;
		check(
			'the read shows the texts and their Dutch',
			fields?.['profile.summary'] === 'ZZ verify summary.' &&
				fields?.['profile.summary.nl'] === 'ZZ verificatie samenvatting.' &&
				fields?.['profile.subtitle'] === null &&
				fields?.['profile.title.nl'] === null,
			JSON.stringify(fields)
		);
		check(
			'with the values in its text',
			text(read).includes('- profile.summary: ZZ verify summary.')
		);

		/* --- filling an empty one is direct, and undoes --------------------- */

		const fill = await callTool(
			'edit_profile',
			{
				profile_id: profileId,
				'profile.subtitle': 'ZZ verify subtitle.',
				rationale: 'verify: fill an empty text'
			},
			KEY
		);
		check(
			'filling an empty text applies directly',
			fill.structuredContent?.applied === true,
			text(fill)
		);
		check('and lands in the column', (await texts()).subtitle === 'ZZ verify subtitle.');
		const undoFill = await revertEdit(Number(fill.structuredContent?.change_id), actor);
		check('undoing it succeeds', undoFill.ok, JSON.stringify(undoFill));
		check('and empties it again', (await texts()).subtitle === null);

		/* --- rewriting the English alone ------------------------------------ */

		const english = await callTool(
			'edit_profile',
			{
				profile_id: profileId,
				'profile.summary': 'ZZ verify summary, rewritten.',
				rationale: 'verify: English only'
			},
			KEY
		);
		check('rewriting a text asks', english.structuredContent?.applied === false, text(english));
		check(
			'and says the Dutch would go stale',
			JSON.stringify(english.structuredContent?.stale_translations) ===
				JSON.stringify(['profile.summary.nl'])
		);
		check('nothing was written', (await texts()).summary === 'ZZ verify summary.');
		await rejectRequest(english.structuredContent?.request_id);

		/* --- both, approved together, described, undone together ------------ */

		const both = await callTool(
			'edit_profile',
			{
				profile_id: profileId,
				'profile.summary': 'ZZ verify summary, rewritten.',
				'profile.summary.nl': 'ZZ verificatie samenvatting, herschreven.',
				'profile.headline': 'ZZ verify headline, rewritten.',
				'profile.headline.nl': 'ZZ verificatie kopregel.',
				rationale: 'verify: English and Dutch together'
			},
			KEY
		);
		check(
			'a change to both is one request with no warning',
			both.structuredContent?.applied === false &&
				both.structuredContent?.stale_translations === undefined,
			text(both)
		);
		const approved = await approveRequest(Number(both.structuredContent?.request_id), actor);
		check('approving it applies', approved.ok, JSON.stringify(approved));
		const afterBoth = await texts();
		const dutchAfterBoth = await dutch();
		check(
			'the English and the Dutch both changed',
			afterBoth.summary === 'ZZ verify summary, rewritten.' &&
				afterBoth.headline === 'ZZ verify headline, rewritten.' &&
				dutchAfterBoth.summary === 'ZZ verificatie samenvatting, herschreven.' &&
				dutchAfterBoth.headline === 'ZZ verificatie kopregel.',
			JSON.stringify({ afterBoth, dutchAfterBoth })
		);

		const bothId = await lastEditId();
		const entry = (await readEditLog(profileId)).find((e) => e.id === bothId);
		const labels = entry ? describeLoggedChange(entry).map((change) => change.label) : [];
		check(
			'the history reads it as two pairs',
			JSON.stringify(labels) ===
				JSON.stringify(['Headline', 'Headline (Dutch)', 'Summary', 'Summary (Dutch)']),
			JSON.stringify(labels)
		);
		check('and can undo it', entry?.revertible === true);

		const undoBoth = await revertEdit(bothId, actor);
		check('undoing the pair succeeds', undoBoth.ok, JSON.stringify(undoBoth));
		const afterUndo = await texts();
		const dutchAfterUndo = await dutch();
		check(
			'and puts both back, the Dutch headline that was not there as not there',
			afterUndo.summary === 'ZZ verify summary.' &&
				afterUndo.headline === 'ZZ verify headline.' &&
				dutchAfterUndo.summary === 'ZZ verificatie samenvatting.' &&
				dutchAfterUndo.headline === undefined,
			JSON.stringify({ afterUndo, dutchAfterUndo })
		);

		/* --- refusals -------------------------------------------------------- */

		const email = await callTool(
			'edit_profile',
			{
				profile_id: profileId,
				'profile.email_address': 'zz-verify@example.com',
				rationale: 'verify: a field it does not have'
			},
			KEY
		);
		check('the email address is not a field', email.isError === true, text(email));

		const long = await callTool(
			'edit_profile',
			{ profile_id: profileId, 'profile.title': 'x'.repeat(300), rationale: 'verify: too long' },
			KEY
		);
		check('a title past 255 characters is refused', long.isError === true, text(long));

		const cleared = await callTool(
			'edit_profile',
			{ profile_id: profileId, 'profile.summary': null, rationale: 'verify: clear under Dutch' },
			KEY
		);
		check('clearing English under its Dutch is refused', cleared.isError === true, text(cleared));

		/* --- the chat, on Basic Info ---------------------------------------- */

		const live = await resolveCapabilities(['edit_profile'], null, actor);
		const capability = live.find((c) => c.capability === 'edit_profile');
		check(
			'the chat resolves it',
			capability?.current?.['profile.summary'] === 'ZZ verify summary.'
		);
		check('and is offered Dutch', liveLanguages(live).includes('nl'));
		const prompt = renderCapabilityPrompt(live);
		check(
			'the prompt shows the texts whole, with the Dutch rule',
			prompt.includes('profile.about_me_text: ZZ verify bio.') &&
				prompt.includes('Their CV also exists in Dutch')
		);
		const schema = buildProposalSchema(['edit_profile'], { languages: liveLanguages(live) });
		check(
			'and the schema takes a Dutch text',
			schema.safeParse({
				reply: 'x',
				proposals: [
					{
						capability: 'edit_profile',
						rationale: 'x',
						changes: [{ field: 'profile.about_me_text.nl', value: 'x' }]
					}
				]
			}).success
		);
	} finally {
		/* --- put everything back -------------------------------------------- */

		// The texts as they were. `date_updated` stays moved on: a snapshot built
		// from the scratch values in between must still read as stale.
		await db
			.update(profiles)
			.set({ ...originalTexts, date_updated: new Date() })
			.where(eq(profiles.id, profileId));
		await db
			.delete(profile_translations)
			.where(
				and(
					eq(profile_translations.profile_id, profileId),
					eq(profile_translations.entity_type, 'profile'),
					eq(profile_translations.entity_id, profileId),
					inArray(profile_translations.field, COLUMNS)
				)
			);
		if (originalOverlay.length > 0) {
			await db.insert(profile_translations).values(originalOverlay.map(({ id: _, ...row }) => row));
		}
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

		const restoredOverlay = await overlay();
		const key = (row: { field: string; locale: string; value: string }) =>
			`${row.field}.${row.locale}=${row.value}`;
		check(
			'the texts are as they were',
			JSON.stringify(await texts()) === JSON.stringify(originalTexts)
		);
		check(
			'and so are their translations',
			JSON.stringify(restoredOverlay.map(key).sort()) ===
				JSON.stringify(originalOverlay.map(key).sort())
		);
	}

	console.log(failures === 0 ? '\nall checks passed' : `\n${failures} FAILED`);
	process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
