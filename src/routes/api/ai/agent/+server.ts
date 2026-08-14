import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { and, desc, eq } from 'drizzle-orm';
import {
	agent_conversations,
	agent_message_proposals,
	agent_messages
} from '$lib/server/db/schema';
import { requireAuth, requireProfileAccess } from '$lib/server/utils/api-helpers';
import { agentChatSchema, parseBody } from '$lib/server/validation/api-schemas';
import { requireCredits } from '$lib/server/billing/require-credits';
import type { ChatMessage } from '$lib/server/llm';
import { createAndGenerateAiChat } from '$lib/server/ai-chat/utils';
import { resolveChatContext } from '$lib/server/ai-chat/chat-context';
import {
	type CapabilityActor,
	buildProposalSchema,
	CAPABILITIES,
	type Capability,
	describeProposalChanges,
	fieldsFromChanges,
	type LiveCapability,
	renderCapabilityPrompt
} from '$lib/server/ai-chat/capabilities';
import { summarizeProposal } from '$lib/server/ai-chat/proposal-summary';

// Profile fields the agent is allowed to reason over. Mirrors the cover-letter
// feature's set — enough to give grounded, personal advice without leaking
// billing/scraper internals into the prompt.
const PROFILE_DATA_FIELDS = [
	'name',
	'title',
	'headline',
	'subtitle',
	'summary',
	'location',
	'core_stack',
	'highlights',
	'work_experiences',
	'side_projects',
	'education',
	'tech_skill_categories',
	'languages'
];

// Recent turns sent to the model as context (~20 user/assistant exchanges).
// Older turns are dropped; summarization can be layered on later if needed.
const MAX_CONTEXT_MESSAGES = 40;

/**
 * Every evidence placeholder the personal_agent_chat templates reference.
 *
 * The provider only returns keys for the sources a route actually requests, but
 * the templates reference all of them — and an un-supplied placeholder ships to
 * the model as the literal text "${jobDetails}". Pre-filling with "" makes the
 * absent ones silently absent, which is what the prompt's own wording assumes.
 *
 * These go to `placeholderDefaults`, never to customVariables. As
 * customVariables they overrode the assembled evidence instead of backfilling
 * it, so every one of these sources was blanked before the model saw it —
 * the assistant reported it "can't access your uploaded documents" on a page
 * whose scope had just fetched them.
 */
const CHAT_CONTEXT_PLACEHOLDERS = [
	'jobDetails',
	'applicationActivity',
	'applicationPipeline',
	'pageScope',
	'activityManifest',
	'profileEditManifest',
	'relevantProjects',
	'relevantStories',
	'relevantApplicationTexts',
	// Not a context source — the capability block, which the capable template
	// references and the plain one doesn't. Pre-filled for the same reason as
	// the rest: an un-supplied placeholder ships as literal "${capabilities}".
	'capabilities'
] as const;

const EMPTY_CONTEXT_VARIABLES: Record<string, string> = Object.fromEntries(
	CHAT_CONTEXT_PLACEHOLDERS.map((key) => [key, ''])
);

/** First line of the opening message, trimmed to a sane title length. */
function deriveTitle(message: string): string {
	const firstLine = message.split('\n')[0].trim();
	return firstLine.length > 80 ? firstLine.slice(0, 77) + '…' : firstLine;
}

/** A validated proposal, ready to store against the assistant turn. */
type StoredProposal = {
	capability: string;
	rationale: string;
	fields: Record<string, unknown>;
	/** What those fields hold right now, so the diff survives being applied. */
	previous: Record<string, unknown>;
	target: { id: number; label: string };
};

/**
 * Field-by-field diff for the card, using the values captured when the
 * proposal was made.
 *
 * Diffed against the proposal's own `previous` rather than off the live
 * capability. `previous` is already the before-image of exactly these fields on
 * exactly this row, so it is both cheaper than a re-read and correct on a list
 * page — where a capability is live over several rows and has no single set of
 * current values, and pairing one row's edit with another row's values would
 * show the user a "from" they never had.
 */
function describeChanges(proposal: StoredProposal) {
	return describeProposalChanges(
		proposal.capability as Capability,
		proposal.fields,
		proposal.previous
	);
}

/** One entry of the model's `proposals` list, before any of it is trusted. */
type ProposalCandidate = {
	capability?: unknown;
	target_id?: unknown;
	rationale?: unknown;
	changes?: unknown;
};

/**
 * A proposal that didn't survive, and what to tell the user about it.
 *
 * `what` names the change in the user's terms — a capability title where we
 * have one, since the ids are ours and mean nothing to them.
 */
type DroppedProposal = { what: string | null; why: string };

type ReadProposal = { ok: true; proposal: StoredProposal } | { ok: false; drop: DroppedProposal };

/**
 * Validate one candidate against the capabilities that were live this turn.
 * Anything unusable is dropped — see readCapableReply for why that is never an
 * error — but it is dropped *with a reason*, because the reply that came back
 * alongside it has usually already promised the user the change.
 */
async function readProposal(
	candidate: ProposalCandidate,
	live: LiveCapability[],
	actor: CapabilityActor
): Promise<ReadProposal> {
	if (!candidate || typeof candidate.capability !== 'string') {
		return {
			ok: false,
			drop: { what: null, why: "it didn't name a change to make" }
		};
	}

	// Only a capability that was live for *this* turn, i.e. one already resolved
	// and authorized above. A model naming anything else is ignored outright.
	const match = live.find((c) => c.capability === candidate.capability);
	if (!match) {
		console.warn(`[agent] dropped a proposal for un-live capability ${candidate.capability}`);
		return {
			ok: false,
			drop: {
				what: titleFor(candidate.capability),
				why: "that isn't something you can change from this page"
			}
		};
	}

	const title = CAPABILITIES[match.capability].title;

	// Which row. One live row needs no naming and the model is not asked for it;
	// several means it must pick, and it may only pick from the list it was
	// shown — every entry of which was authorized before it was rendered. An id
	// outside that list is not resolved and looked up, it is refused: the whole
	// rule is that the model may NAME a row, never reach one.
	const target =
		match.targets.length === 1
			? match.targets[0]
			: match.targets.find((t) => t.id === Number(candidate.target_id));

	if (!target) {
		console.warn(
			`[agent] dropped a proposal for ${match.capability}: target_id ${String(candidate.target_id)}`
		);
		return {
			ok: false,
			drop: {
				what: title,
				why:
					candidate.target_id === undefined || candidate.target_id === null
						? "it didn't say which one to change"
						: "it named one that isn't on this page"
			}
		};
	}

	const changes = Array.isArray(candidate.changes) ? candidate.changes : [];
	const fields = fieldsFromChanges(
		match.capability,
		changes as { field: string; value: unknown }[]
	);
	if (Object.keys(fields).length === 0) {
		console.warn(`[agent] dropped an empty proposal for ${match.capability}`);
		return {
			ok: false,
			// The common cause is a field name belonging to a different capability:
			// the wire schema offers every live capability's names under one enum,
			// so the model can file a job field under an application proposal, and
			// fieldsFromChanges drops what doesn't belong.
			drop: { what: title, why: 'it came back with no usable fields' }
		};
	}

	// Read for the named row, not off the live capability: with several rows
	// there is no single `current`, and validating an edit to one row against
	// another row's values is how a check passes for the wrong reason.
	const current = match.current ?? (await CAPABILITIES[match.capability].current(target, actor));

	const valid = CAPABILITIES[match.capability].validate(fields, current);
	if (!valid.ok) {
		console.warn(`[agent] dropped an invalid proposal: ${valid.error}`);
		return { ok: false, drop: { what: title, why: valid.error } };
	}

	return {
		ok: true,
		proposal: {
			capability: match.capability,
			rationale: typeof candidate.rationale === 'string' ? candidate.rationale : '',
			fields,
			// Narrowed to the proposed fields — the whole `current` blob would store
			// a row snapshot rather than a before-image of this edit, and the two
			// drift apart the moment a capability grows a field.
			previous: Object.fromEntries(
				Object.keys(fields)
					.filter((key) => key in current)
					.map((key) => [key, current[key]])
			),
			target
		}
	};
}

/** A capability's user-facing name, when it names one we know. */
function titleFor(capability: string): string | null {
	return capability in CAPABILITIES ? CAPABILITIES[capability as Capability].title : null;
}

/**
 * The note appended to a reply when a change it describes never became a card.
 *
 * This exists because the reply and the proposals fail independently. The model
 * writes "I've corrected the salary and rewritten the description", and if the
 * salary entry doesn't validate the user gets that sentence with one card under
 * it and nothing saying why — a promise silently half-kept, which reads as the
 * assistant lying rather than as a check doing its job.
 *
 * Written in the user's terms, not ours: capability ids are internal, so a drop
 * we can't name says only that something didn't come through.
 */
function renderDropNotice(drops: DroppedProposal[]): string {
	if (drops.length === 0) return '';

	const lines = drops.map(({ what, why }) =>
		what ? `- **${what}** — ${why}.` : `- One change didn't come through: ${why}.`
	);

	return `---\n\n${
		drops.length === 1
			? "*One change I described couldn't be offered:*"
			: "*Some changes I described couldn't be offered:*"
	}\n\n${lines.join('\n')}\n\n*Ask again and I'll retry it.*`;
}

/**
 * Read a structured reply, keeping the message even when the proposals are
 * unusable.
 *
 * Every failure here degrades to "reply, fewer proposals" rather than failing
 * the turn. The user asked a question and the model answered it; a malformed or
 * unauthorized edit suggestion is not a reason to show them an error, and
 * dropping it is the conservative direction — the worst case is that a change
 * they wanted isn't offered, and they ask again.
 *
 * Dropping it *silently* was not, which is what this used to do. "They ask
 * again" only works if they know there is something to ask again for, and the
 * reply routinely describes the change that just vanished. So every drop
 * carries a reason and the reasons are appended to the reply.
 *
 * Each entry is judged on its own: one bad proposal in a pair does not take the
 * good one down with it, which is the point of them being separate cards.
 */
async function readCapableReply(
	raw: string,
	live: LiveCapability[],
	actor: CapabilityActor
): Promise<{ reply: string; proposals: StoredProposal[] }> {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		// Structured output was requested but didn't come back as JSON. The text
		// is still the assistant's answer.
		return { reply: raw, proposals: [] };
	}

	// Valid JSON that isn't an object — null, an array, a bare number. `null` is
	// the one that happened: a failed structured generation reached here as the
	// literal string "null", which JSON.parse accepts, and reading `.reply` off
	// it threw. A function whose entire contract is "degrade rather than fail
	// the turn" was the one place that 500'd.
	//
	// The root cause is fixed in the LLM layer, which now treats a null parse as
	// the failed generation it is. This stays because the guarantee belongs here
	// too: whatever a model returns, the user gets an answer or a clean error,
	// never a stack trace.
	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		return { reply: raw, proposals: [] };
	}

	const body = parsed as {
		reply?: unknown;
		proposals?: unknown;
	};
	const reply = typeof body.reply === 'string' && body.reply.trim() ? body.reply : raw;

	const candidates = Array.isArray(body.proposals) ? body.proposals : [];
	const read = await Promise.all(
		candidates.map((c) => readProposal(c as ProposalCandidate, live, actor))
	);
	const drops = read.filter((r) => !r.ok).map((r) => r.drop);

	// One card per capability AND row. A model that splits the same edit across
	// two entries would otherwise render two cards over one row, where applying
	// both means the second silently overwrites the first.
	//
	// Keyed on the row as well as the capability, because since a capability can
	// be live over a list, two entries naming DIFFERENT rows are two real edits
	// — "rename this language and that one" is one capability and two cards.
	// Keying on the capability alone would have silently dropped the second.
	//
	// Not reported as a drop: both entries are the same KIND of change over the
	// same row, so the user still gets a card for what the reply described.
	// Telling them one was discarded would describe our deduplication, not a
	// change they're missing.
	const seen = new Set<string>();
	const proposals = read
		.filter((r) => r.ok)
		.map((r) => r.proposal)
		.filter((p) => {
			const key = `${p.capability}:${p.target.id}`;
			if (seen.has(key)) {
				console.warn(`[agent] dropped a duplicate proposal for ${key}`);
				return false;
			}
			seen.add(key);
			return true;
		});

	const notice = renderDropNotice(drops);
	return {
		// Appended to the reply itself rather than returned beside it, so it is
		// persisted with the message. Two things follow that a separate field
		// wouldn't give: reloading a 12h-resumable thread shows the same thing the
		// live turn did, and the next turn replays the note to the model as its own
		// words — so a retry starts out knowing which change was rejected and why.
		reply: notice ? `${reply}\n\n${notice}` : reply,
		proposals
	};
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = requireAuth(locals);

	const { profile_id, conversation_id, message, route, routeParams } = parseBody(
		agentChatSchema,
		await request.json()
	);

	await requireProfileAccess(profile_id, user.id);
	// Same as every other generation endpoint. The chat was priced at 1 when it
	// was a profile blob and a question; it now assembles the same evidence and
	// calls the same writing model as a cover letter, so it costs the same.
	await requireCredits(user.id, 5);

	// Resolve the target conversation up front (ownership-checked). A new thread
	// is created lazily only after a successful reply, below.
	//
	// Matched on the profile as well as the user: a thread is conducted AS a
	// profile, and every turn in it is answered from that profile's material and
	// stamped with its id. Appending a turn under a different profile produced a
	// thread that was half one applicant and half another, with nothing in the
	// transcript marking where it changed hands.
	let conversation: { id: number; title: string | null } | undefined;
	if (conversation_id != null) {
		const [existing] = await db
			.select({ id: agent_conversations.id, title: agent_conversations.title })
			.from(agent_conversations)
			.where(
				and(
					eq(agent_conversations.id, conversation_id),
					eq(agent_conversations.user_id, user.id),
					eq(agent_conversations.profile_id, profile_id)
				)
			)
			.limit(1);
		if (!existing) {
			return json({ success: false, message: 'Conversation not found.' }, { status: 404 });
		}
		conversation = existing;
	}

	// Prior turns (oldest → newest), capped to the recent window. The new message
	// isn't persisted yet, so it isn't included here.
	const history: ChatMessage[] = conversation
		? (
				await db
					.select({
						role: agent_messages.role,
						content: agent_messages.content
					})
					.from(agent_messages)
					.where(eq(agent_messages.conversation_id, conversation.id))
					.orderBy(desc(agent_messages.id))
					.limit(MAX_CONTEXT_MESSAGES)
			)
				.reverse()
				.map((m) => ({
					role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
					content: m.content
				}))
		: [];

	// What the user is looking at, and what may be changed there — both resolved
	// server-side from the route and authorized against this profile. `route` is
	// client-supplied, so nothing derived from it is taken on trust.
	const isStaff =
		!!(user as { is_staff?: boolean }).is_staff || !!(user as { is_admin?: boolean }).is_admin;
	const { context, capabilities } = await resolveChatContext({
		routeId: route,
		params: routeParams ?? {},
		profileId: profile_id,
		isStaff,
		message
	});

	// Turns with nothing to propose keep the original plain-text path exactly:
	// same prompt, no schema, no capability block, no extra tokens. Only a page
	// where the user can actually change something pays for the structured one.
	const capable = capabilities.length > 0;
	const result = await createAndGenerateAiChat(
		profile_id,
		capable ? 'personal_agent_chat_capable' : 'personal_agent_chat',
		{
			message,
			...(capable ? { capabilities: renderCapabilityPrompt(capabilities) } : {})
		},
		undefined,
		{
			profileDataFields: PROFILE_DATA_FIELDS,
			context,
			// Fallbacks, NOT customVariables: passed as customVariables these blank
			// every source the line above just assembled, because customVariables are
			// the deliberate override. See placeholderDefaults in utils.ts.
			placeholderDefaults: EMPTY_CONTEXT_VARIABLES,
			// Prior turns replayed as real messages rather than recapped as a
			// transcript inside the prompt — same as the four editors.
			historyMessages: history,
			...(capable
				? {
						responseSchema: buildProposalSchema(capabilities.map((c) => c.capability))
					}
				: {})
		}
	);

	if (!result.success || !result.aiChat?.response) {
		return json(
			{
				success: false,
				message: result.message || 'The assistant could not respond.'
			},
			{ status: 422 }
		);
	}

	const { reply, proposals } = capable
		? await readCapableReply(result.aiChat.response, capabilities, {
				profileId: profile_id,
				isStaff
			})
		: { reply: result.aiChat.response, proposals: [] as StoredProposal[] };
	const now = new Date();

	// Persist only now that we have a reply: create the thread on first message,
	// otherwise just bump its activity timestamp.
	if (!conversation) {
		const [created] = await db
			.insert(agent_conversations)
			.values({
				user_id: user.id,
				profile_id,
				title: deriveTitle(message),
				date_created: now,
				last_message_at: now
			})
			.returning({
				id: agent_conversations.id,
				title: agent_conversations.title
			});
		conversation = created;
	} else {
		await db
			.update(agent_conversations)
			.set({ last_message_at: now })
			.where(eq(agent_conversations.id, conversation.id));
	}

	// Still one insert for the exchange itself (a half-written one is worse than
	// none), and returning, because the assistant row's id is what the proposals
	// hang off.
	const [, assistantMessage] = await db
		.insert(agent_messages)
		.values([
			{
				conversation_id: conversation.id,
				role: 'user',
				content: message,
				profile_id,
				date_created: now
			},
			{
				conversation_id: conversation.id,
				role: 'assistant',
				content: reply,
				profile_id,
				ai_chat_id: result.aiChat.id,
				date_created: now
			}
		])
		.returning({ id: agent_messages.id });

	// A row per proposal, and their ids are what the client posts back to apply
	// one — so they have to come out of the insert, not be derived from the
	// message. Skipped entirely when there is nothing to propose, which is the
	// overwhelmingly common turn.
	const stored =
		proposals.length > 0
			? await db
					.insert(agent_message_proposals)
					.values(
						proposals.map((p) => ({
							message_id: assistantMessage.id,
							capability: p.capability,
							rationale: p.rationale,
							fields: p.fields,
							previous: p.previous,
							target: p.target,
							date_created: now
						}))
					)
					.returning({ id: agent_message_proposals.id })
			: [];

	return json({
		success: true,
		reply,
		conversation_id: conversation.id,
		title: conversation.title,
		message_id: assistantMessage.id,
		proposals: await Promise.all(
			proposals.map(async (proposal, i) => {
				const title = CAPABILITIES[proposal.capability as keyof typeof CAPABILITIES].title;
				// Paired with the current value so the card renders a diff, not a
				// list of new values with no idea what they replace.
				const changes = describeChanges(proposal);
				return {
					id: stored[i].id,
					capability: proposal.capability,
					title,
					rationale: proposal.rationale,
					target: proposal.target,
					changes,
					// The same edit as prose. The card doesn't need it; everything that
					// isn't a card does — see proposal-summary.ts.
					summary: summarizeProposal({
						title,
						target: proposal.target,
						changes,
						rationale: proposal.rationale
					}),
					applied_at: null
				};
			})
		)
	});
};
