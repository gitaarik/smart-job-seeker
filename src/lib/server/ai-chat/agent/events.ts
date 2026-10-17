/**
 * What the panel is told while a turn runs (planning/ASSISTANT-AGENT.md
 * § Streaming): the node that started, each tool call as it starts and ends
 * with a glance of what it is about and never its result, then the reply or
 * the error. The same words name a turn's reads under the reply afterwards.
 */
import { CAPABILITIES, type Capability } from '$lib/server/ai-chat/capabilities';
import { isMcpCapability } from '$lib/server/mcp/tools';

export type TurnNode = 'prepare' | 'agent' | 'tools' | 'finish';

export type TurnEvent =
	| { type: 'step'; node: TurnNode }
	| { type: 'tool'; name: string; label: string; status: 'started' | 'done' | 'refused' }
	| ({ type: 'reply' } & Record<string, unknown>)
	| { type: 'error'; message: string };

/** The custom event the graph's nodes dispatch a tool event on. */
export const TURN_EVENT = 'assistant_turn';

type Args = Record<string, unknown>;

/** What a read is about, by the ids the call names. */
const SUBJECTS: Record<string, (args: Args) => string> = {
	read_profile_section: (a) => `their ${String(a.section ?? 'profile').replace(/_/g, ' ')}`,
	list_jobs: () => 'their jobs',
	read_job: (a) => `job ${a.job_id}`,
	list_applications: () => 'their applications',
	read_application: (a) => `application ${a.application_id}`,
	list_texts: () => 'their texts',
	read_text: (a) => `${String(a.kind ?? 'text').replace(/_/g, ' ')} ${a.text_id}`,
	list_resume_versions: () => 'their resume versions',
	read_activity_entry: (a) => `entry ${a.entry_id} of application ${a.application_id}`,
	list_documents: () => 'their documents',
	read_document: (a) => `document ${a.document_id}`
};

/**
 * A read in the user's terms, for the line under the reply: what was read, by
 * the ids the call named. The arguments' values are never shown beyond an id,
 * and a result never is.
 */
export function describeRead(call: { name: string; args: Args }): string {
	const subject = SUBJECTS[call.name];
	return subject ? subject(call.args ?? {}) : call.name;
}

/**
 * A tool call as it runs, for the step line: what is being read or listed,
 * or which change is being proposed, by the capability's title.
 */
export function describeToolCall(call: { name: string; args: Args }): string {
	if (call.name in SUBJECTS) {
		const verb = call.name.startsWith('list_') ? 'Listing' : 'Reading';
		return `${verb} ${describeRead(call)}`;
	}
	if (isMcpCapability(call.name)) {
		return `Proposing a change: ${CAPABILITIES[call.name as Capability].title}`;
	}
	return call.name;
}
