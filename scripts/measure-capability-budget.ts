/**
 * What the "Changes you can propose" block costs on each profile page.
 *
 * `CAPABILITY_PROMPT_BUDGET_CHARS` is a ratchet, and the number in it is only
 * worth what the last measurement was: every live capability's contract ships
 * on every capable turn, so the block's size is paid per turn and grows with
 * both the declaration and the applicant. A page that grew a section — the
 * child collections joining PROFILE_RESOURCES is the case this was written for
 * — has to be re-measured against a real profile rather than estimated.
 *
 *   docker compose exec -T app npx tsx scripts/measure-capability-budget.ts <profileId>
 *
 * Prints one line per route: how many capabilities are live, what the rendered
 * block costs, and how much of the budget is left. A route over budget is not
 * dropped by anything — a page's own capabilities are never given up (see
 * `fitMatchedCapabilities`) — so an overflow here is a real overflow of the
 * turn, not a graceful degradation.
 */
import {
	fitMatchedCapabilities,
	renderCapabilityPrompt,
	resolveCapabilities
} from '$lib/server/ai-chat/capabilities';
import { CAPABILITY_PROMPT_BUDGET_CHARS } from '$lib/server/ai-chat/capabilities';
import { scopeForRoute, tieredCapabilities } from '$lib/server/ai-chat/chat-context';
import type { ContextEntity } from '$lib/server/ai-chat/generation-context';
import { PROFILE_RESOURCES, PROFILE_RESOURCE_NAMES } from '$lib/server/profile/resources';
import { readOwnedRows } from '$lib/server/profile/write';

const profileId = Number(process.argv[2]);
if (!Number.isInteger(profileId))
	throw new Error('usage: measure-capability-budget.ts <profileId>');

/** Every route a profile section is reachable from, with the row it is about. */
async function routes(): Promise<Array<{ route: string; entity: ContextEntity | null }>> {
	const out: Array<{ route: string; entity: ContextEntity | null }> = [];
	const seen = new Set<string>();

	for (const name of PROFILE_RESOURCE_NAMES) {
		const { page, detailPath } = PROFILE_RESOURCES[name];

		if (!seen.has(page.path)) {
			seen.add(page.path);
			out.push({ route: page.path, entity: null });
		}

		if (!detailPath) continue;
		const route = `${page.path}/[id]`;
		if (seen.has(route)) continue;
		seen.add(route);

		// The busiest row of the section, since the block scales with what hangs
		// off it — measuring an empty role would say the page is free.
		const rows = await readOwnedRows(name, { profileId });
		if (rows.length === 0) continue;
		const busiest = await heaviest(
			name,
			rows.map((row) => Number(row.id))
		);
		out.push({ route, entity: { type: 'profile_section', resource: name, id: busiest } });
	}

	return out;
}

/** The row of `name` with the most children, by however many sections hang off it. */
async function heaviest(name: string, ids: number[]): Promise<number> {
	const children = PROFILE_RESOURCE_NAMES.filter((child) => {
		const { owner } = PROFILE_RESOURCES[child];
		return owner.via === 'parent' && owner.parent === name;
	});
	if (children.length === 0) return ids[0];

	const counts = new Map(ids.map((id) => [id, 0]));
	for (const child of children) {
		const key = (PROFILE_RESOURCES[child].owner as { key: string }).key;
		for (const row of await readOwnedRows(child, { profileId })) {
			const parent = Number(row[key]);
			if (counts.has(parent)) counts.set(parent, (counts.get(parent) ?? 0) + 1);
		}
	}

	return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

async function main() {
	console.log(`profile ${profileId}, budget ${CAPABILITY_PROMPT_BUDGET_CHARS}\n`);

	for (const { route, entity } of await routes()) {
		const scope = scopeForRoute(route);
		const declared = scope.capabilities ?? [];
		if (declared.length === 0) {
			console.log(`${route.padEnd(34)}  —  no capabilities`);
			continue;
		}

		const live = await resolveCapabilities(declared, entity, { profileId, isStaff: false });
		const size = renderCapabilityPrompt(live).length;

		// What the turn would actually carry: the page's subject, then its child
		// collections while they fit. `declared` is the ceiling, not the cost.
		const tiers = tieredCapabilities(scope);
		const [subject, ...children] = await Promise.all(
			[tiers.subject, ...tiers.children].map((group) =>
				resolveCapabilities(group, entity, { profileId, isStaff: false })
			)
		);
		const admitted = fitMatchedCapabilities(subject, children);
		const kept = renderCapabilityPrompt(admitted).length;
		const kept_names = new Set(admitted.map((c) => c.capability));

		console.log(
			`${route.padEnd(34)}  ${String(admitted.length).padStart(2)}/${live.length} live` +
				`  ${String(kept).padStart(6)} of ${String(size).padStart(6)} chars` +
				`  ${CAPABILITY_PROMPT_BUDGET_CHARS - kept} left` +
				`${
					admitted.length < live.length
						? '\n     dropped for budget: ' +
							live
								.filter((c) => !kept_names.has(c.capability))
								.map((c) => c.capability)
								.join(', ')
						: ''
				}`
		);
		// Incremental, not standalone: a section's rows are printed once for all
		// its verbs, so a verb measured alone would count a list the section is
		// already paying for. Grouped by section for the same reason.
		const bySection = new Map<string, typeof live>();
		for (const c of live) {
			const section = c.capability.slice(c.capability.indexOf('_') + 1);
			bySection.set(section, [...(bySection.get(section) ?? []), c]);
		}

		let sofar: typeof live = [];
		for (const [section, group] of bySection) {
			const before = renderCapabilityPrompt(sofar).length;
			sofar = [...sofar, ...group];
			const targets = Math.max(...group.map((c) => c.targets.length));
			console.log(
				`     ${section.padEnd(38)} ${String(renderCapabilityPrompt(sofar).length - before).padStart(6)} chars` +
					`  ${group.length} verb(s), ${targets} target(s)`
			);
		}
	}
}

main().then(
	() => process.exit(0),
	(err) => {
		console.error(err);
		process.exit(1);
	}
);
