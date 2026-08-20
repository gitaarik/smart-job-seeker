/**
 * The skills capabilities against a real profile, end to end and self-cleaning.
 *
 * The unit tests mock the database, so they assert the shape of the queries
 * this layer builds and not that Postgres accepts them. Everything a skill does
 * differently from the other eight sections is SQL the mocks cannot check: a
 * join to find the owner, a subquery to scope a write, an ordering that starts
 * on the parent's table.
 *
 *   npx dotenvx run -f /app/.env -- npx tsx scripts/verify-skills.ts <profileId>
 */
import {
	countOwnedRows,
	createRow,
	deleteRow,
	readOwnedRow,
	readOwnedRows,
	updateRow
} from '$lib/server/profile/write';
import {
	CAPABILITIES,
	resolveCapabilities,
	renderCapabilityPrompt
} from '$lib/server/ai-chat/capabilities';
import { verbsFor } from '$lib/server/ai-chat/profile-capabilities';
import { profileEditManifestText } from '$lib/server/ai-chat/profile-edit-manifest';

const profileId = Number(process.argv[2]);
const actor = { profileId, isStaff: false };

let failures = 0;
function check(what: string, ok: boolean, detail: unknown = '') {
	console.log(`${ok ? '  ok  ' : ' FAIL '} ${what}${detail === '' ? '' : `  → ${detail}`}`);
	if (!ok) failures++;
}

async function main() {
	const groups = await readOwnedRows('skill_category', { profileId });
	const skills = await readOwnedRows('skill', { profileId });
	console.log(`profile ${profileId}: ${groups.length} groups, ${skills.length} skills\n`);

	check(
		'every skill carries its group name',
		skills.every((s) => typeof s.category === 'string')
	);
	check(
		'ordered by group, then within it',
		true,
		skills
			.slice(0, 3)
			.map((s) => `${s.category}/${s.name}`)
			.join(', ')
	);
	check('count matches the read', (await countOwnedRows('skill', { profileId })) === skills.length);

	const mine = skills[0];
	check(
		'a row of theirs reads back',
		(await readOwnedRow('skill', { profileId }, mine.id))?.id === mine.id
	);
	check(
		'a row of someone else’s does not',
		(await readOwnedRow('skill', { profileId: profileId + 100000 }, mine.id)) === null
	);

	// --- a create, a move and a delete, on a row this script owns ---
	// The group as the assistant names it — the heading plus whatever tells it
	// apart from a group of the same name, which is what `category` has to carry.
	const { PROFILE_RESOURCES } = await import('$lib/server/profile/resources');
	const group = PROFILE_RESOURCES.skill_category.rowLabel(groups[0]);
	const created = await createRow(
		'skill',
		{ profileId },
		{
			name: 'ZZ Verify Scratch',
			category: group,
			level: 'expert'
		}
	);
	check(
		'creates under a named group',
		created.ok,
		created.ok ? `id ${created.id}` : (created as { error: string }).error
	);

	if (created.ok) {
		const back = await readOwnedRow('skill', { profileId }, created.id);
		check(
			'reads back with its group',
			back?.category === group,
			`${back?.category} / ${back?.level}`
		);

		const wrong = await createRow(
			'skill',
			{ profileId },
			{ name: 'ZZ Nope', category: 'No Such Group' }
		);
		check(
			'refuses an unknown group',
			!wrong.ok,
			wrong.ok ? '' : (wrong as { error: string }).error
		);

		if (groups.length > 1) {
			const other = PROFILE_RESOURCES.skill_category.rowLabel(groups[1]);
			const moved = await updateRow('skill', { profileId }, created.id, { category: other });
			check('moves between groups', moved.ok, moved.ok ? JSON.stringify(moved.previous) : '');
			const after = await readOwnedRow('skill', { profileId }, created.id);
			check('lands in the new group', after?.category === other, String(after?.category));
		}

		const gone = await deleteRow('skill', { profileId }, created.id);
		check('cleans up after itself', gone.ok);
	}

	// --- what the assistant actually gets ---
	const live = await resolveCapabilities(
		[...verbsFor('skill'), ...verbsFor('skill_category')] as never,
		null,
		actor
	);
	const listed = live.find((c) => c.capability === 'edit_skill');
	check(
		'the skills page resolves six capabilities',
		live.length === 6,
		live.map((c) => c.capability).join(', ')
	);
	const { TARGET_LIST_CAP } = await import('$lib/server/ai-chat/capabilities');
	check(
		'the target list is capped and says so',
		!!listed &&
			(skills.length <= TARGET_LIST_CAP
				? !listed.omitted
				: listed.targets.length === TARGET_LIST_CAP &&
					listed.omitted === skills.length - TARGET_LIST_CAP),
		`${listed?.targets.length} listed, ${listed?.omitted ?? 0} omitted`
	);

	const narrowed = await resolveCapabilities(['edit_skill'] as never, null, actor, {
		message: `can you set my ${mine.name} level to expert?`
	});
	check(
		'naming a skill narrows to it',
		skills.length <= TARGET_LIST_CAP || narrowed[0]?.targets.length < TARGET_LIST_CAP,
		`${narrowed[0]?.targets.length} target(s): ${narrowed[0]?.targets
			.map((t) => t.label)
			.join(', ')
			.slice(0, 80)}`
	);

	const prompt = renderCapabilityPrompt(live);
	check('the page fits its budget', prompt.length <= 19000, `${prompt.length} chars`);
	check('the contract names real groups', prompt.includes(String(groups[0].name)));

	// --- the whole write path a proposal card takes ---
	//
	// createRow above is the layer underneath; this is `executeCapability`, which
	// is what the Apply button and the MCP tools call: authorize, re-read, coerce,
	// validate, write, log — and then the undo the feed offers.
	const { executeCapability } = await import('$lib/server/ai-chat/capabilities');
	const { revertEdit, readEditLog } = await import('$lib/server/ai-chat/edit-log');

	const addTarget = await CAPABILITIES.add_skill.resolve(null, actor);
	const added = await executeCapability(
		'add_skill',
		addTarget!,
		actor,
		{ 'skill.name': 'ZZ Verify Applied', 'skill.category': group, 'skill.level': 'proficient' },
		'chat'
	);
	check(
		'applies an add through the capability path',
		added.ok,
		added.ok ? `edit ${added.editId}` : added.error
	);

	const scratch = (await readOwnedRows('skill', { profileId })).find(
		(row) => row.name === 'ZZ Verify Applied'
	);
	check('the row is there, in the group it named', scratch?.category === group);

	if (scratch) {
		const target = { id: scratch.id, label: String(scratch.name) };
		const edited = await executeCapability(
			'edit_skill',
			target,
			actor,
			{ 'skill.level': 'expert' },
			'chat'
		);
		check(
			'applies an edit, recording what it replaced',
			edited.ok,
			JSON.stringify(edited.ok ? edited.previous : edited.error)
		);

		if (edited.ok && edited.editId) {
			await revertEdit(edited.editId, actor);
			const after = await readOwnedRow('skill', { profileId }, scratch.id);
			check('undoes it back to the old value', after?.level === 'proficient', String(after?.level));
		}

		const hidden = await executeCapability('hide_skill', target, actor, {}, 'chat');
		const hiddenRow = await readOwnedRow('skill', { profileId }, scratch.id);
		check(
			'hides it by writing the document tags',
			hidden.ok && JSON.stringify(hiddenRow?.tags ?? []).includes('!resume'),
			JSON.stringify(hiddenRow?.tags ?? null)
		);

		if (hidden.ok && hidden.editId) {
			await revertEdit(hidden.editId, actor);
			const after = await readOwnedRow('skill', { profileId }, scratch.id);
			check(
				'undoes the hide to the exact tags it found',
				(after?.tags ?? null) === null,
				JSON.stringify(after?.tags ?? null)
			);
		}

		const log = await readEditLog(profileId, 5);
		check(
			'every one of them is in the feed',
			log.slice(0, 3).every((e) => e.capability.endsWith('_skill')),
			log
				.slice(0, 3)
				.map((e) => `${e.capability}${e.revertedAt ? ' (undone)' : ''}`)
				.join(', ')
		);

		await deleteRow('skill', { profileId }, scratch.id);
		check(
			'scratch row cleaned up',
			(await readOwnedRow('skill', { profileId }, scratch.id)) === null
		);
	}

	// --- the same registry, over MCP ---
	const { toolsFor } = await import('$lib/server/mcp/tools');
	const tools = await toolsFor('write');
	const addSkill = tools.find((t) => t.name === 'add_skill');
	check('MCP serves a tool per profile capability', tools.length === 27, `${tools.length} tools`);
	check(
		'add_skill takes the group by name',
		!!addSkill?.inputSchema.properties?.['skill.category'],
		JSON.stringify(addSkill?.inputSchema.required)
	);

	const manifest = await profileEditManifestText(profileId);
	check(
		'the manifest lists both sections',
		manifest.includes('Skills —') && manifest.includes('Skill categories —')
	);
	console.log(
		`\n${manifest
			.split('\n')
			.filter((l) => l.startsWith('- Skill'))
			.join('\n')}`
	);

	console.log(`\n${failures === 0 ? 'all checks passed' : `${failures} FAILED`}`);
	process.exit(failures === 0 ? 0 : 1);
}

main();
