import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { getSelectedProfileId } from '../../profile/utils';
import { CAPABILITIES, executeCapability } from '$lib/server/ai-chat/capabilities';
import { directiveField } from '$lib/server/ai-chat/directive-capability';
import {
	CONSUMER_LABELS,
	DIRECTIVE_TOPIC_NAMES,
	DIRECTIVE_TOPICS,
	isDirectiveTopic,
	loadDirectiveHistory,
	loadDirectives,
	MAX_STATEMENT_CHARS,
	topicLabel,
	type DirectiveConsumer
} from '$lib/server/ai-chat/directives';

/** "the assistant, cover letters and …", from the consumer keys a row carries. */
function usedBy(appliesTo: string[]): string[] {
	return appliesTo.map((key) => CONSUMER_LABELS[key as DirectiveConsumer] ?? key);
}

/** Who wrote a row, in the words the Recent Changes feed uses for the same thing. */
const SOURCE_LABELS: Record<string, string> = {
	chat: 'the assistant, when you applied its card',
	mcp: 'a connected app, once you approved it',
	ui: 'you, on this page',
	import: 'an import',
	undo: 'an undo'
};

export const load: PageServerLoad = async ({ parent }) => {
	const { selectedProfile } = await parent();
	if (!selectedProfile) redirect(302, '/home');

	const [live, history] = await Promise.all([
		loadDirectives(selectedProfile.id),
		loadDirectiveHistory(selectedProfile.id)
	]);
	const byTopic = new Map(live.map((d) => [d.topic, d]));

	return {
		maxChars: MAX_STATEMENT_CHARS,
		// Every topic, held or not: an empty one is where they add one by hand, and
		// the list of topics is also the answer to "what can a directive be about".
		topics: DIRECTIVE_TOPIC_NAMES.map((topic) => {
			const held = byTopic.get(topic);
			return {
				topic,
				label: DIRECTIVE_TOPICS[topic].label,
				what: DIRECTIVE_TOPICS[topic].what,
				usedBy: usedBy(held?.appliesTo ?? DIRECTIVE_TOPICS[topic].appliesTo),
				live: held
					? {
							statement: held.statement,
							statedAt: held.statedAt,
							source: SOURCE_LABELS[held.source] ?? held.source
						}
					: null
			};
		}),
		history: history.map((entry) => ({
			id: entry.id,
			label: topicLabel(entry.topic),
			statement: entry.statement,
			statedAt: entry.statedAt,
			endedAt: entry.endedAt,
			replaced: entry.supersededBy !== null
		}))
	};
};

/**
 * Whoever is signed in, and which profile they have selected. The same shape
 * as Recent Changes' actions, for the same reason: a form action has no
 * `parent()`, so the profile comes from the cookie.
 */
async function actorFor(
	cookies: Parameters<Actions[string]>[0]['cookies'],
	locals: App.Locals
): Promise<{ profileId: number; isStaff: boolean } | { error: string; status: number }> {
	const user = locals.user as { id: string; is_staff?: boolean; is_admin?: boolean } | undefined;
	if (!user) return { error: 'Not signed in.', status: 401 };

	const profileId = await getSelectedProfileId(cookies, user.id);
	if (!profileId) return { error: 'No profile selected.', status: 400 };

	return { profileId, isStaff: !!user.is_staff || !!user.is_admin };
}

/**
 * One write through the registry, whichever button sent it.
 *
 * Not a direct call to the write layer: going through `executeCapability` is
 * what puts a change made here into Recent Changes with an undo, validated by
 * the same rules as a proposal — "one action name means one change, whoever
 * made it", as the edit log puts it.
 */
async function write(
	cookies: Parameters<Actions[string]>[0]['cookies'],
	locals: App.Locals,
	form: FormData,
	statement: string | null
) {
	const actor = await actorFor(cookies, locals);
	if ('error' in actor) return fail(actor.status, { error: actor.error });

	const topic = String(form.get('topic') ?? '');
	if (!isDirectiveTopic(topic)) return fail(400, { error: 'Unknown topic.' });

	const target = await CAPABILITIES.edit_directives.resolve(null, actor);
	if (!target) return fail(400, { error: 'Directives are not available on this profile.' });

	// Saving the text that is already there, or stopping a topic that has none,
	// changes nothing — and through the registry it would still put an entry in
	// Recent Changes saying something had.
	const current = await CAPABILITIES.edit_directives.current(target, actor);
	if ((current[directiveField(topic)] ?? null) === statement) return { saved: topic };

	const outcome = await executeCapability(
		'edit_directives',
		target,
		actor,
		{ [directiveField(topic)]: statement },
		'ui'
	);
	if (!outcome.ok) return fail(400, { error: outcome.error, topic });
	return { saved: topic };
}

export const actions: Actions = {
	save: async ({ request, cookies, locals }) => {
		const form = await request.formData();
		const text = String(form.get('statement') ?? '').trim();
		// Blank is not "stop": that has its own button, and a cleared textarea
		// submitted by accident must not retire a rule someone meant to keep.
		if (!text) {
			return fail(400, {
				error: 'Write the directive first. To stop one, use Stop using.',
				topic: String(form.get('topic') ?? '')
			});
		}
		return write(cookies, locals, form, text);
	},

	stop: async ({ request, cookies, locals }) =>
		write(cookies, locals, await request.formData(), null)
};
