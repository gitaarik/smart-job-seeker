/**
 * The tools this server offers, built from the same registry the chat uses.
 *
 * ## Why only the profile capabilities
 *
 * `CAPABILITIES` also holds five hand-written verbs over jobs and applications,
 * and they are not here. Not an oversight and not laziness: those are
 * *page-bound*. Their `resolve` takes the entity the user is looking at, and
 * they have no `resolveMany`, so over MCP — where there is no page — the only
 * way to reach one would be to let an agent name a job by id.
 *
 * That is a different authorization question, not a smaller one. A job row is
 * shared: `/jobs/[id]` renders any job to any signed-in user, and `canEditJob`
 * is about who may edit a shared record rather than about who owns it. Handing
 * an external agent id-addressed access to that table is a decision worth
 * making on its own, and it is not the one this plan is about — the goal was
 * "change any part of the *profile*". Profile rows are owned outright, and
 * `authorize` is `row.profile_id === actor.profileId`, which is a sentence an
 * external caller cannot argue with.
 *
 * ## Why the field names keep their prefix
 *
 * `work_experience.summary` rather than `summary`, even though each tool has its
 * own schema here and could not collide. Because the schema IS
 * `CAPABILITIES[c].fields` — no translation layer, nothing to drift — and
 * because an agent holding seventeen tools benefits from a field name that says
 * which section it belongs to. The contract prose explains the prefix already.
 *
 * ## Why the declared types are strict where the wire types are loose
 *
 * `WIRE_TYPES` is deliberately permissive because a provider generating
 * structured output wanders, and `coerceValue` cleans up afterwards. That
 * coercion still runs here — every call goes through `pickCapabilityFields` —
 * so the schema can afford to say `string` and mean it. An `anyOf: [string,
 * number]` in a tool schema is noise an agent has to read on every call to buy
 * nothing it does not already get.
 */

import { CAPABILITIES, type Capability } from '$lib/server/ai-chat/capabilities';
import { PROFILE_CAPABILITY_NAMES } from '$lib/server/ai-chat/profile-capabilities';
import {
	PROFILE_RESOURCE_NAMES,
	PROFILE_RESOURCES,
	type ProfileResourceName
} from '$lib/server/profile/resources';
import type { FieldKind } from '$lib/server/utils/field-kinds';
import { annotationsFor, readToolAnnotations, type ToolAnnotations } from './tiers';

/** A JSON Schema object, as narrow as this file needs it to be. */
export interface JsonSchema {
	type: string;
	properties?: Record<string, unknown>;
	required?: string[];
	items?: unknown;
	description?: string;
	enum?: string[];
	additionalProperties?: boolean;
}

export interface McpTool {
	name: string;
	description: string;
	inputSchema: JsonSchema;
	annotations: ToolAnnotations;
}

/** The read tools, which are what most agents want and all they should need. */
export const READ_TOOLS = [
	'list_profile_sections',
	'read_profile_section',
	'list_changes',
	'list_pending_changes'
] as const;
export type ReadTool = (typeof READ_TOOLS)[number];

export function isReadTool(name: string): name is ReadTool {
	return (READ_TOOLS as readonly string[]).includes(name);
}

/** Which capabilities this server exposes — the generated profile ones, all of them. */
export const MCP_CAPABILITIES: Capability[] = PROFILE_CAPABILITY_NAMES;

export function isMcpCapability(name: string): name is Capability {
	return (MCP_CAPABILITIES as string[]).includes(name);
}

function jsonType(kind: FieldKind): Record<string, unknown> {
	switch (kind) {
		case 'int':
			return { type: 'integer' };
		case 'stringArray':
			return { type: 'array', items: { type: 'string' } };
		case 'date':
			return { type: 'string', description: 'YYYY-MM-DD' };
		default:
			return { type: 'string' };
	}
}

/**
 * The argument every tool takes, and the one place this server refuses to be
 * helpful.
 *
 * The key already binds a profile, so this is redundant in the happy case —
 * which is exactly what makes it worth requiring. An agent that has remembered
 * a profile id from a previous session, against a key since re-bound to a
 * different profile, gets an error rather than a write into the wrong person's
 * history. The alternative is inferring it, and `api/ai/agent/scope.ts` already
 * decided that question for this codebase: guessing is how a thread gets
 * answered from the wrong history.
 */
const PROFILE_ID_PROPERTY = {
	type: 'integer',
	description:
		'The profile to act on. Must match the profile this key is bound to — ' +
		'call list_profile_sections to find it. It is never inferred.'
};

const RATIONALE_PROPERTY = {
	type: 'string',
	description:
		'Why you are making this change, in the applicant’s terms. Shown to them ' +
		'verbatim when a change needs their approval, so write it for them and ' +
		'not for a log.'
};

function writeTool(capability: Capability): McpTool {
	const def = CAPABILITIES[capability];
	const isAdd = capability.startsWith('add_');
	const isHide = capability.startsWith('hide_');

	const properties: Record<string, unknown> = { profile_id: PROFILE_ID_PROPERTY };
	const required = ['profile_id'];

	// An add has no row yet; everything else names one. `entry_id` rather than
	// `id`, so a schema that also carries `work_experience.*` fields cannot be
	// read as though the id were one of them.
	if (!isAdd) {
		properties.entry_id = {
			type: 'integer',
			description: 'Which entry, by the id returned from read_profile_section.'
		};
		required.push('entry_id');
	}

	for (const [name, kind] of Object.entries(def.fields)) {
		properties[name] = jsonType(kind);
	}

	properties.rationale = RATIONALE_PROPERTY;
	required.push('rationale');

	return {
		name: capability,
		description: `${def.title}.\n\n${def.contract}`,
		inputSchema: {
			type: 'object',
			properties,
			required,
			// Named fields only. A client that invents one gets an error rather than
			// having it silently dropped, which is the difference between an agent
			// that corrects itself and one that reports success having written
			// nothing.
			additionalProperties: false
		},
		annotations: {
			...annotationsFor(capability),
			// A hide writes nothing but tags, so an agent reading only the schema
			// would see a tool with no fields and no clue what it does.
			title: isHide ? `${def.title} (needs your approval)` : def.title
		}
	};
}

const SECTION_ENUM = PROFILE_RESOURCE_NAMES as string[];

const readTools: Record<ReadTool, McpTool> = {
	list_profile_sections: {
		name: 'list_profile_sections',
		description: `Every part of the profile you can read or change, how many entries each
holds, and which tool changes it. Start here: it also returns the profile_id
this key is bound to, which every other tool requires.

A count of zero means the applicant has nothing in that section yet — not that
you cannot see it.`,
		inputSchema: { type: 'object', properties: {}, required: [], additionalProperties: false },
		annotations: readToolAnnotations('List the parts of the profile')
	},
	read_profile_section: {
		name: 'read_profile_section',
		description: `The entries in one section, with the id each change tool needs and the
current value of every field you are allowed to write.

Read before you write. An edit is a partial patch over what is here, and a
field you do not send keeps what it holds.`,
		inputSchema: {
			type: 'object',
			properties: {
				profile_id: PROFILE_ID_PROPERTY,
				section: { type: 'string', enum: SECTION_ENUM, description: 'Which part of the profile.' }
			},
			required: ['profile_id', 'section'],
			additionalProperties: false
		},
		annotations: readToolAnnotations('Read one section')
	},
	list_changes: {
		name: 'list_changes',
		description: `What has already been changed on this profile and by which surface — the
chat, or an agent through this server. Includes what each change replaced, and
whether it has since been undone.

Use it to avoid re-doing something the applicant already reverted.`,
		inputSchema: {
			type: 'object',
			properties: {
				profile_id: PROFILE_ID_PROPERTY,
				limit: { type: 'integer', description: 'How many, newest first. Default 20, max 50.' }
			},
			required: ['profile_id'],
			additionalProperties: false
		},
		annotations: readToolAnnotations('List recent changes')
	},
	list_pending_changes: {
		name: 'list_pending_changes',
		description: `Changes you have asked for that are waiting on the applicant.

There is no tool that approves one, and asking again does not help — a second
request for the same thing is a second thing for them to read. If something you
asked for is still pending, say so and move on.`,
		inputSchema: {
			type: 'object',
			properties: { profile_id: PROFILE_ID_PROPERTY },
			required: ['profile_id'],
			additionalProperties: false
		},
		annotations: readToolAnnotations('List changes awaiting approval')
	}
};

/**
 * The tool list, filtered by what the credential may do.
 *
 * A `read` key is not shown the write tools at all. Listing a tool that always
 * refuses is how an agent spends a conversation retrying, and the refusal
 * carries no information it could act on — the fix is on the applicant's
 * settings page, not in the transcript.
 */
export function toolsFor(scope: 'read' | 'propose' | 'write'): McpTool[] {
	const tools: McpTool[] = READ_TOOLS.map((name) => readTools[name]);
	if (scope === 'read') return tools;
	return [...tools, ...MCP_CAPABILITIES.map(writeTool)];
}

/** The section a generated capability acts on. */
export function sectionFor(capability: Capability): ProfileResourceName {
	return capability.slice(capability.indexOf('_') + 1) as ProfileResourceName;
}

/** Where a person would change this section by hand, for a result that has to say so. */
export function pageFor(capability: Capability): { name: string; path: string } | null {
	const section = sectionFor(capability);
	const resource = PROFILE_RESOURCES[section];
	return resource ? { name: resource.page.name, path: resource.page.path } : null;
}
