/**
 * The turn's tool set: the chat as a second client of the MCP tool registry
 * (planning/ASSISTANT-AGENT.md § One registry, two clients).
 *
 * Eleven of the MCP server's read tools, and one of its write tools per
 * capability live on the page, which is the same set the capabilities block
 * rendered as prose until now, from the same `resolveChatContext`. Every
 * schema loses `profile_id`: the executor acts for one profile and supplies
 * it, so the model has no id to get wrong. The definitions are the tool's
 * name, its description with the contract in it, and its JSON Schema, in the
 * shape the provider layer binds (llm/langchain.ts ToolDefinition).
 */
import type { ToolDefinition } from '$lib/server/llm';
import type { CapabilityActor, LiveCapability } from '$lib/server/ai-chat/capabilities';
import {
	chatReadTools,
	withoutProfileId,
	writeToolsFor,
	type McpTool
} from '$lib/server/mcp/tools';

/**
 * How much of a long text one read returns to the chat. The server reads
 * 60,000 at a time for a client with a context of its own; a slice here sits
 * in the turn's context and is paid for again on every round after it.
 */
export const CHAT_SLICE_CHARS = 6000;

export interface ChatTools {
	definitions: ToolDefinition[];
	/** The read tools bound, by name. */
	reads: string[];
	/** The capabilities bound as write tools, in the order they were live. */
	writes: string[];
}

/** An MCP tool as the provider layer binds it. */
export function toolDefinition(tool: McpTool): ToolDefinition {
	return {
		name: tool.name,
		description: tool.description,
		parameters: tool.inputSchema as unknown as Record<string, unknown>
	};
}

/**
 * The tool set for one turn.
 *
 * `anonymous`: the turn is about an application whose employer reads it
 * without the applicant's name, and the profile the model was given has had
 * the identity taken out. `read_profile_section` would put it back, so it is
 * not offered; the executor scrubs what the other reads return.
 */
export async function chatToolSet(
	live: LiveCapability[],
	actor: CapabilityActor,
	options: { sliceChars?: number; anonymous?: boolean } = {}
): Promise<ChatTools> {
	const reads = chatReadTools(options.sliceChars ?? CHAT_SLICE_CHARS).filter(
		(tool) => !(options.anonymous && tool.name === 'read_profile_section')
	);
	const capabilities = live.map((c) => c.capability);
	const writes = (
		await writeToolsFor(capabilities, { profileId: actor.profileId, isStaff: actor.isStaff })
	).map(withoutProfileId);
	return {
		definitions: [...reads, ...writes].map(toolDefinition),
		reads: reads.map((tool) => tool.name),
		writes: capabilities
	};
}
