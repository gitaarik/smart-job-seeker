/**
 * The chat answered by the agent (planning/ASSISTANT-AGENT.md § Streaming).
 *
 * With the flag on, POST /api/ai/agent runs the turn as a graph. A client
 * that accepts `text/event-stream` is told the steps as they happen, one
 * event per `data:` line, and gets the reply as the last event; any other
 * client gets the reply as JSON, the shape the panel consumed before the
 * flag, with the turn's reads added. The JSON branch stays while the flag is
 * on trial and goes with Phase 6. The content type is the event stream's own
 * so that a proxy flushes each event as it is written rather than holding
 * the body until the end, which would turn the steps into one burst.
 */
import { json } from '@sveltejs/kit';
import { isLLMOutputValidationMessage } from '$lib/server/llm';
import { reserveAiChatId, reserveConversationId, spendBlock } from '$lib/server/ai-chat/utils';
import { describeRead, type TurnEvent } from '$lib/server/ai-chat/agent/events';
import {
	runTurn,
	streamTurn,
	type TurnInput,
	type TurnOutcome
} from '$lib/server/ai-chat/agent/turn';
import type { ReadRecord } from '$lib/server/documents/retrieval-record';
import { errorTracker } from '$lib/server/monitoring/error-tracker';
import { aiChatTraceSeed, startTrace } from '$lib/server/monitoring/telemetry';

export interface AgentRequest {
	request: Request;
	userId: string;
	isStaff: boolean;
	profileId: number;
	conversation: { id: number; title: string | null } | null;
	message: string;
	route: string | null | undefined;
	routeParams: Record<string, string>;
	pasted: readonly string[] | undefined;
}

/** A turn's reads as the panel shows them under the reply: what was read, in the user's terms. */
export function readsForPanel(reads: ReadRecord[] | null | undefined) {
	return (reads ?? [])
		.filter((read) => read.ok && !read.fromMemo)
		.map((read) => ({
			tool: read.tool,
			label: describeRead({ name: read.tool, args: read.args })
		}));
}

export function wantsEventStream(request: Request): boolean {
	return (request.headers.get('accept') ?? '').includes('text/event-stream');
}

/** The reply as the panel consumes it, with the staff record where the session is staff. */
function payload(outcome: TurnOutcome, isStaff: boolean) {
	return {
		success: true,
		reply: outcome.reply,
		conversation_id: outcome.conversation.id,
		title: outcome.conversation.title,
		message_id: outcome.messageId,
		proposals: outcome.proposals,
		reads: readsForPanel(outcome.reads),
		// Why this turn could propose what it did, and what it read in full.
		// Staff only, and gated here rather than in the component: what the page
		// ships is the boundary, not what it chooses to render.
		...(isStaff
			? {
					capabilityRecord: outcome.capabilityRecord,
					readRecords: outcome.reads,
					rounds: outcome.rounds,
					capped: outcome.capped
				}
			: {})
	};
}

/** What the user is told when a turn fails: the same words as before the flag where the failure is the same. */
function failureMessage(error: unknown): string {
	const message = error instanceof Error ? error.message : String(error);
	if (isLLMOutputValidationMessage(message)) {
		return "The assistant's answer didn't come back in a usable form. Please try again.";
	}
	return 'The assistant could not respond.';
}

export async function respondWithAgent(req: AgentRequest): Promise<Response> {
	const blocked = await spendBlock(req.profileId);
	if (blocked) return json({ success: false, message: blocked }, { status: 422 });

	// The turn's root trace (planning/LANGFUSE.md § Trace model), seeded from
	// its first ai_chats row, whose id is reserved first so the trace can be
	// found from the row. A new thread's id is reserved as well, so its first
	// turn is in its session.
	const aiChatId = await reserveAiChatId();
	const conversationId = req.conversation?.id ?? (await reserveConversationId());
	const input: TurnInput = {
		userId: req.userId,
		profileId: req.profileId,
		isStaff: req.isStaff,
		conversation: req.conversation,
		conversationId,
		aiChatId,
		message: req.message,
		route: req.route,
		routeParams: req.routeParams,
		pasted: req.pasted
	};
	const traced = (work: () => Promise<TurnOutcome>) =>
		startTrace(
			{
				name: 'answer_message',
				kind: 'agent',
				seed: aiChatTraceSeed(aiChatId),
				userId: req.userId,
				sessionId: `assistant:${conversationId}`,
				metadata: { profile_id: String(req.profileId) },
				input: req.message
			},
			work,
			(outcome) => ({ output: outcome.reply })
		);
	const report = (error: unknown) =>
		errorTracker.logError(
			'The assistant agent turn failed',
			error instanceof Error ? error : new Error(String(error)),
			{
				operation: 'respondWithAgent',
				metadata: { profileId: req.profileId, conversationId, aiChatId }
			}
		);

	if (!wantsEventStream(req.request)) {
		try {
			return json(payload(await traced(() => runTurn(input)), req.isStaff));
		} catch (error) {
			report(error);
			return json({ success: false, message: failureMessage(error) }, { status: 422 });
		}
	}

	const encoder = new TextEncoder();
	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const send = (event: TurnEvent) =>
				controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
			try {
				const outcome = await traced(() => streamTurn(input, send));
				send({ type: 'reply', ...payload(outcome, req.isStaff) });
			} catch (error) {
				report(error);
				send({ type: 'error', message: failureMessage(error) });
			} finally {
				controller.close();
			}
		}
	});
	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'X-Accel-Buffering': 'no'
		}
	});
}
