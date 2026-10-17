/**
 * A LangGraph node as a step of the open trace (planning/LANGFUSE.md, Phase
 * 6; planning/ASSISTANT-AGENT.md § Records and tracing).
 *
 * `traced` wraps a node so that what it runs, model calls among them, nests
 * under a step named after the node and carrying LangGraph's own position
 * (`langgraph_node`, `langgraph_step`), which Langfuse draws its graph view
 * from. The node's update is the step's output unless the caller says what to
 * record instead. With no trace open it only runs the node. Shared by the
 * scraper agent (cloud, scraper-agent/graph.ts) and the assistant
 * (ai-chat/agent/graph.ts).
 *
 * Done here rather than with Langfuse's LangChain callback handler, whose
 * observations never become the active span: a model call made inside a node
 * would hang off the root, and an interrupt would be drawn as an error.
 */
import type { LangGraphRunnableConfig } from '@langchain/langgraph';
import {
	traceStep,
	type ExpectedStop,
	type LangfuseObservationType,
	type StepRecord
} from './telemetry';

/** LangGraph's name and superstep for a step, which Langfuse draws its graph view from. */
export function graphPosition(config: LangGraphRunnableConfig | undefined) {
	return {
		langgraph_node: config?.metadata?.langgraph_node,
		langgraph_step: config?.metadata?.langgraph_step
	};
}

export interface TracedOptions<Update> {
	/**
	 * What a stop that is not a failure says, for a graph that interrupts or
	 * is cancelled: the scraper agent's question to the developer, a run
	 * stopped from the admin page. Given the node's config, since the signal
	 * and the interrupt both travel on it.
	 */
	expected?: (config: LangGraphRunnableConfig | undefined) => ExpectedStop;
	/** What the step records of the update; the whole of it unless said otherwise. */
	describe?: (update: Update) => StepRecord;
}

export function traced<State, Update>(
	name: string,
	kind: LangfuseObservationType,
	node: (state: State, config: LangGraphRunnableConfig) => Promise<Update>,
	options: TracedOptions<Update> = {}
) {
	return (state: State, config: LangGraphRunnableConfig) =>
		traceStep(
			name,
			kind,
			() => node(state, config),
			(update) => options.describe?.(update) ?? { output: update },
			{ metadata: graphPosition(config), expected: options.expected?.(config) }
		);
}
