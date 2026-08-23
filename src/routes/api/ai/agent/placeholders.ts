/**
 * A sibling module, not an export of `+server.ts`.
 *
 * SvelteKit validates a `+server.ts`'s exports and refuses anything that is not
 * a method handler or a known config key — so exporting this list from there
 * turned every chat turn into a 500, at request time, with every unit test
 * still green: the tests import the module directly, and `vite build` is not
 * run by the oss CI that would otherwise have caught it.
 */

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
export const CHAT_CONTEXT_PLACEHOLDERS = [
	'jobDetails',
	'applicationActivity',
	'applicationPipeline',
	'pageScope',
	'activityManifest',
	'profileEditManifest',
	'assistantAbilities',
	'relevantProjects',
	'relevantStories',
	'relevantApplicationTexts',
	// Not a context source — the capability block, which the capable template
	// references and the plain one doesn't. Pre-filled for the same reason as
	// the rest: an un-supplied placeholder ships as literal "${capabilities}".
	'capabilities'
] as const;
