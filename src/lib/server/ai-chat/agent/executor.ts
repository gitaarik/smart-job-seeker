/**
 * What the agent's tool calls do (planning/ASSISTANT-AGENT.md § One registry,
 * two clients).
 *
 * A read runs through the MCP server's own read tools (mcp/call.ts readTool)
 * for the turn's actor: this profile, the `propose` scope, documents in
 * reach, and the chat's slice size. A write never reaches a row. The call is
 * held to the checks a parsed proposal passes today (proposals.ts), the
 * proposal is kept for the turn's end to store as a card, and the model is
 * answered with a receipt that says nothing has changed. A call the checks
 * refuse is answered with the reason, as a tool's refusal is, so the model
 * can correct it rather than report success.
 *
 * The same call twice (same tool, same arguments) is answered from the turn's
 * memo: a loop re-reading what it has is spending the context, not learning.
 * A whole read (a job, an application, a list) longer than the slice is cut,
 * with the cut stated; the three sliced reads return a slice already and say
 * where to continue, so they are left as they are.
 */
import type { ToolCall } from '$lib/server/llm';
import {
	CAPABILITIES,
	type CapabilityActor,
	type LiveCapability
} from '$lib/server/ai-chat/capabilities';
import { readTool, type ReadActor } from '$lib/server/mcp/call';
import { targetingFor } from '$lib/server/mcp/entities';
import { isMcpCapability, isReadTool } from '$lib/server/mcp/tools';
import { type Identity, leadsToApplicant } from '$lib/server/profile/anonymity';
import { CHAT_SLICE_CHARS } from './tools';
import {
	type DroppedProposal,
	type ProposalCandidate,
	readProposal,
	type StoredProposal,
	traceProposal
} from './proposals';

/**
 * What the model is told when a write call has been recorded. The wording is
 * the line against the two failures this shape invites: with a call made and
 * an answer in the conversation, the model has the shape of an action it
 * took, and the apply rate is where drift would show; and told only that
 * nothing had changed, it made the same call again (the spike,
 * planning/ASSISTANT-AGENT.md § The spike, Result). So it says what to do
 * next, and what to say.
 */
export const PROPOSAL_RECEIPT =
	'Recorded as a proposal. The user will see it as a card under your reply and can ' +
	'apply it there. Do not call this tool again for the same change. Write your reply ' +
	'now, and say the change is proposed and waiting for them, never that it has been made.';

/** The reads that return a slice and say where to continue; never cut here. */
const SLICED_READS = new Set(['read_text', 'read_activity_entry', 'read_document']);

export interface ExecutedCall {
	call: ToolCall;
	kind: 'read' | 'propose';
	/** What the model is answered with. */
	content: string;
	/** A refusal, which the provider may show the model as an error. */
	isError: boolean;
	/** The proposal a write call became, when it passed the checks. */
	proposal?: StoredProposal;
	/** Why a write call was refused. */
	drop?: DroppedProposal;
	/** The result's size before any cut; `content.length` after. */
	chars: number;
	/** Whether a whole read was cut to the slice. */
	cut: boolean;
	ms: number;
	/** Answered from the turn's memo: the same call was made before. */
	fromMemo: boolean;
}

export interface TurnExecutorOptions {
	actor: CapabilityActor;
	/** The capabilities live on this turn, which a write call must name one of. */
	live: LiveCapability[];
	/**
	 * The applicant's identity, when the turn is about an anonymous application
	 * and the profile the model holds has had it taken out. Every read result is
	 * scrubbed of it, and `read_profile_section` is refused outright.
	 */
	identity?: Identity | null;
	sliceChars?: number;
}

export class TurnExecutor {
	private readonly memo = new Map<string, ExecutedCall>();
	private readonly reader: ReadActor;
	/** The proposals the turn's write calls became, in the order they were made. */
	readonly proposals: StoredProposal[] = [];

	constructor(private readonly options: TurnExecutorOptions) {
		this.reader = {
			profileId: options.actor.profileId,
			scope: 'propose',
			readScope: 'documents',
			sliceChars: options.sliceChars ?? CHAT_SLICE_CHARS
		};
	}

	async execute(call: ToolCall): Promise<ExecutedCall> {
		const key = `${call.name}:${stableJson(call.args)}`;
		const earlier = this.memo.get(key);
		if (earlier) return { ...earlier, call, fromMemo: true };

		const started = performance.now();
		const done = isReadTool(call.name) ? await this.read(call) : await this.propose(call);
		const result: ExecutedCall = {
			...done,
			ms: Math.round(performance.now() - started),
			fromMemo: false
		};
		this.memo.set(key, result);
		return result;
	}

	private async read(call: ToolCall): Promise<Omit<ExecutedCall, 'ms' | 'fromMemo'>> {
		if (!isReadTool(call.name)) throw new Error(`${call.name} is not a read tool`);
		const answer = (content: string, isError: boolean, chars = content.length, cut = false) => ({
			call,
			kind: 'read' as const,
			content,
			isError,
			chars,
			cut
		});

		if (this.options.identity && call.name === 'read_profile_section') {
			return answer(
				'Not offered on this turn: this application is anonymous, and the profile ' +
					'above is what may be read of it.',
				true
			);
		}

		const result = await readTool(call.name, call.args, this.reader);
		let text = result.content.map((c) => c.text).join('\n');
		if (this.options.identity) text = scrubIdentity(text, this.options.identity);

		const limit = this.reader.sliceChars ?? CHAT_SLICE_CHARS;
		if (SLICED_READS.has(call.name) || text.length <= limit) {
			return answer(text, !!result.isError);
		}
		return answer(
			`${text.slice(0, limit)}\n\n[Cut at ${limit.toLocaleString('en-US')} of ` +
				`${text.length.toLocaleString('en-US')} characters. Ask for less: a list by ` +
				`a smaller limit, a record by its own read.]`,
			!!result.isError,
			text.length,
			true
		);
	}

	private async propose(call: ToolCall): Promise<Omit<ExecutedCall, 'ms' | 'fromMemo'>> {
		const candidate = candidateFromCall(call);
		const read = await traceProposal(candidate, () =>
			readProposal(candidate, this.options.live, this.options.actor, { strictTarget: true })
		);
		if (!read.ok) {
			return {
				call,
				kind: 'propose',
				content: refusal(read.drop, call, this.options.live),
				isError: true,
				drop: read.drop,
				chars: 0,
				cut: false
			};
		}
		this.proposals.push(read.proposal);
		return {
			call,
			kind: 'propose',
			content: PROPOSAL_RECEIPT,
			isError: false,
			proposal: read.proposal,
			chars: 0,
			cut: false
		};
	}
}

/**
 * What a refused write call is answered with: the reason, and where one
 * exists, the way out. A bare refusal had the model drop the request from its
 * reply without a word, or explain the refusal with a reason it made up (the
 * spike, planning/ASSISTANT-AGENT.md § The spike, Result).
 */
function refusal(drop: DroppedProposal, call: ToolCall, live: LiveCapability[]): string {
	const hint =
		drop.kind === 'unlive'
			? live.length > 0
				? ` The changes you can propose on this page: ${live.map((c) => c.capability).join(', ')}.`
				: ' Nothing can be changed from this page.'
			: drop.kind === 'empty' && isMcpCapability(call.name)
				? ` The fields ${call.name} takes, each sent flat under its own name: ` +
					`${Object.keys(CAPABILITIES[call.name].fields).join(', ')}.`
				: '';
	return `Not recorded: ${drop.why}.${hint} Nothing has changed.`;
}

/**
 * A write tool call as a proposal candidate. The call's arguments are the
 * capability's fields, the id of the row named as the MCP tool names it
 * (job_id, application_id, text_id, version_id, or entry_id for a profile
 * row), and the rationale; a `profile_id` the model was never given is
 * dropped rather than trusted.
 *
 * A field sent nested where its name has a dot (`{language: {name}}` for
 * `language.name`) is flattened one level: the names say which section a
 * field belongs to, and a model reads that as an object often enough that
 * refusing it lost a request outright (the spike, message 2 of run 5).
 */
export function candidateFromCall(call: ToolCall): ProposalCandidate {
	const { rationale, profile_id: _profile, ...rest } = call.args;
	const idArg = isMcpCapability(call.name)
		? (targetingFor(call.name)?.arg ?? 'entry_id')
		: 'entry_id';
	const { [idArg]: targetId, ...fields } = rest;
	return {
		capability: call.name,
		target_id: targetId,
		rationale,
		changes: Object.entries(flattenFields(call.name, fields)).map(([field, value]) => ({
			field,
			value
		}))
	};
}

function flattenFields(
	capability: string,
	fields: Record<string, unknown>
): Record<string, unknown> {
	const names = isMcpCapability(capability) ? Object.keys(CAPABILITIES[capability].fields) : [];
	const flat: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(fields)) {
		const nested =
			value !== null &&
			typeof value === 'object' &&
			!Array.isArray(value) &&
			names.some((name) => name.startsWith(`${key}.`));
		if (!nested) {
			flat[key] = value;
			continue;
		}
		for (const [sub, inner] of Object.entries(value as Record<string, unknown>)) {
			flat[`${key}.${sub}`] = inner;
		}
	}
	return flat;
}

/**
 * The applicant's identity taken out of a read result, for a turn about an
 * anonymous application: their name, their own business's name, and any link
 * that leads to them. The same marks `anonymiseProfileData` takes out of the
 * profile blob, applied to prose rather than to rows.
 */
export function scrubIdentity(text: string, identity: Identity): string {
	let out = text;
	if (identity.name) {
		out = out.replace(new RegExp(escapeRegExp(identity.name), 'gi'), 'the applicant');
	}
	if (identity.companyName) {
		out = out.replace(new RegExp(escapeRegExp(identity.companyName), 'gi'), 'their own business');
	}
	if (identity.linkMarks.length > 0) {
		out = out.replace(/https?:\/\/[^\s)>\]]+/g, (url) =>
			leadsToApplicant(url, identity) ? '[a link to the applicant]' : url
		);
	}
	return out;
}

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The arguments with their keys in one order, so the memo sees one call as one. */
function stableJson(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
	if (value && typeof value === 'object') {
		return `{${Object.keys(value)
			.sort()
			.map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`)
			.join(',')}}`;
	}
	return JSON.stringify(value) ?? 'undefined';
}
