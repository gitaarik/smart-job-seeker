/**
 * What a tool call actually does.
 *
 * The order is fixed and every step is on our side of the boundary: verify the
 * key, check the stated profile against the one it is bound to, resolve the
 * target through the registry's own targeting, read the current values, decide
 * the tier from them, combine that with the credential's scope, and then either
 * write or record a request.
 *
 * Nothing here trusts an argument. The profile comes from the key, the label
 * comes from the database, the tier comes from what the row currently holds,
 * and `executeCapability` re-authorizes and re-validates on the far side of all
 * of it. What the agent supplies is field values and a rationale — the two
 * things only it can know.
 *
 * ## Elicitation is not implemented, and that is a decision
 *
 * The design called for confirming Tier 2 inline where the client supports
 * `elicitation/create`, falling back to a deep link. Two things make the
 * fallback the mechanism rather than the fallback:
 *
 *  - Client support is uneven, so the link has to exist and work regardless.
 *    A confirmation path that only some clients take is a second code path
 *    covering a fraction of calls, and the covered fraction is the one already
 *    running in an attentive user's terminal.
 *  - It would cost this server its statelessness. Elicitation is a
 *    server→client *request*, and over streamable HTTP the reply arrives as a
 *    separate POST that has to be correlated by session — which means holding
 *    sessions in memory. That is precisely the shape of the port-9333 tunnel
 *    registry, the app's known blocker on running more than one node.
 *
 * So Tier 2 records the request, notifies, and returns a link. The record is
 * written before anyone is asked, so it never depends on what the client can
 * do.
 */

import {
	CAPABILITIES,
	executeCapability,
	pickCapabilityFields,
	type Capability,
	type CapabilityActor,
	type CapabilityTarget
} from '$lib/server/ai-chat/capabilities';
import { profileEditCounts } from '$lib/server/ai-chat/profile-edit-manifest';
import {
	assistantFields,
	PROFILE_RESOURCES,
	type ProfileResourceName
} from '$lib/server/profile/resources';
import { readOwnedRows } from '$lib/server/profile/write';
import { readEditLog } from '$lib/server/ai-chat/edit-log';
import { createNotification } from '$lib/server/notifications';
import {
	listProfileApplications,
	readProfileApplication
} from '$lib/server/applications/profile-applications';
import { listProfileJobs, readProfileJob } from '$lib/server/jobs/profile-jobs';
import { recentDirectWrites } from './burst';
import { targetingFor } from './entities';
import { createRequest, readRequests, requestPath } from './requests';
import { dispositionFor, tierForWrite } from './tiers';
import { isMcpCapability, isReadTool, pageFor, sectionFor, MCP_CAPABILITIES } from './tools';
import { JOB_CAPABILITIES } from './entities';
import type { VerifiedMcpKey } from './keys';

/** What a tool call answers with. `isError` is the protocol's, not an exception. */
export interface ToolResult {
	content: { type: 'text'; text: string }[];
	structuredContent?: Record<string, unknown>;
	isError?: boolean;
}

function ok(text: string, structured?: Record<string, unknown>): ToolResult {
	return { content: [{ type: 'text', text }], structuredContent: structured };
}

function fail(text: string): ToolResult {
	// A tool-level error rather than a JSON-RPC one: the call was well-formed and
	// the server is fine, so the model is the one that needs to read this and
	// change what it does. A protocol error would be handled by the client and
	// might never reach it.
	return { content: [{ type: 'text', text }], isError: true };
}

type Args = Record<string, unknown>;

function argInt(args: Args, name: string): number | null {
	const value = args[name];
	if (typeof value === 'number' && Number.isInteger(value)) return value;
	if (typeof value === 'string' && /^\d+$/.test(value)) return Number.parseInt(value, 10);
	return null;
}

/**
 * The profile the caller says it means, checked against the one it may reach.
 *
 * A mismatch is an error and never a silent redirect to the bound profile. An
 * agent that has remembered an id from a session before the key was re-bound is
 * exactly the case this catches, and writing "helpfully" to the right profile
 * would hide the fact that the agent's whole picture is of a different one.
 */
function profileMismatch(args: Args, key: VerifiedMcpKey): ToolResult | null {
	const stated = argInt(args, 'profile_id');
	if (stated === null) {
		return fail(
			'profile_id is required. Call list_profile_sections to find which one this key is bound to.'
		);
	}
	if (stated !== key.profileId) {
		return fail(
			`This key is bound to profile ${key.profileId}, not ${stated}. It cannot read or ` +
				`change any other profile.`
		);
	}
	return null;
}

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

async function listProfileSections(key: VerifiedMcpKey): Promise<ToolResult> {
	const counts = await profileEditCounts(key.profileId);
	const sections = counts.map(({ name, rows }) => {
		const resource = PROFILE_RESOURCES[name];
		return {
			section: name,
			entries: rows,
			page: resource.page.name,
			tools: MCP_CAPABILITIES.filter((c) => sectionFor(c) === name)
		};
	});

	const lines = sections.map(
		(s) => `- ${s.section} (${s.page}): ${s.entries} ${s.entries === 1 ? 'entry' : 'entries'}`
	);

	// The profile is what this tool is about, but it is also the tool an agent is
	// told to call first — so it is the one place that can say the other half of
	// the data exists. A tool list says the same thing and is read less carefully.
	return ok(
		`Profile ${key.profileId}, reachable with this key (scope: ${key.scope}).\n\n` +
			`${lines.join('\n')}\n\n` +
			`Their jobs and applications are separate: list_jobs and list_applications, ` +
			`same profile_id.`,
		{ profile_id: key.profileId, scope: key.scope, sections }
	);
}

async function readProfileSection(args: Args, key: VerifiedMcpKey): Promise<ToolResult> {
	const section = args.section;
	if (typeof section !== 'string' || !(section in PROFILE_RESOURCES)) {
		return fail(`Unknown section "${String(section)}".`);
	}

	const name = section as ProfileResourceName;
	const resource = PROFILE_RESOURCES[name];
	const fields = assistantFields(resource);
	const rows = await readOwnedRows(name, { profileId: key.profileId });

	const entries = rows.map((row) => ({
		entry_id: row.id,
		label: resource.rowLabel(row),
		fields: Object.fromEntries(
			Object.keys(fields).map((column) => [`${name}.${column}`, row[column] ?? null])
		)
	}));

	if (entries.length === 0) {
		return ok(`No ${resource.page.name.toLowerCase()} yet. Use add_${name} to create one.`, {
			section: name,
			entries
		});
	}

	return ok(
		`${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} in ${name}:\n\n` +
			entries.map((e) => `- [${e.entry_id}] ${e.label}`).join('\n'),
		{ section: name, entries }
	);
}

async function listChanges(args: Args, key: VerifiedMcpKey): Promise<ToolResult> {
	const requested = argInt(args, 'limit') ?? 20;
	const entries = await readEditLog(key.profileId, Math.min(Math.max(requested, 1), 50));

	const changes = entries.map((e) => ({
		change_id: e.id,
		capability: e.capability,
		made_by: e.source,
		target: e.target.label,
		fields: e.fields,
		replaced: e.previous,
		undone: e.revertedAt !== null,
		// Why an undo would be refused: a later change wrote the same fields of the
		// same row, so this one has to wait for it. There is no undo tool here —
		// this is so an agent asked to roll something back can say which change the
		// applicant has to take back first, rather than that it cannot be done.
		undo_blocked_by: e.supersededBy,
		at: e.createdAt.toISOString()
	}));

	if (changes.length === 0) return ok('Nothing has been changed on this profile yet.', { changes });

	return ok(
		changes
			.map(
				(c) =>
					`- ${c.at} ${c.capability} on "${c.target}" via ${c.made_by}` +
					(c.undone ? ' (since undone)' : '')
			)
			.join('\n'),
		{ changes }
	);
}

async function listPendingChanges(key: VerifiedMcpKey): Promise<ToolResult> {
	const pending = await readRequests(key.profileId, ['pending']);
	const requests = pending.map((r) => ({
		request_id: r.id,
		capability: r.capability,
		target: r.target.label,
		fields: r.fields,
		asked_at: r.createdAt.toISOString(),
		review_at: requestPath(r.id)
	}));

	if (requests.length === 0) return ok('Nothing is waiting for approval.', { requests });

	return ok(
		`${requests.length} waiting on the applicant:\n\n` +
			requests.map((r) => `- [${r.request_id}] ${r.capability} on "${r.target}"`).join('\n'),
		{ requests }
	);
}

/**
 * The jobs this profile has, which is not the same set as "the jobs".
 *
 * `listProfileJobs` is where that distinction is enforced; this only renders it.
 * `editable` is carried on every row rather than filtered out by default,
 * because an agent that cannot see the unedittable ones cannot tell the
 * applicant *why* it did not fix the salary on the one they asked about.
 */
async function listJobs(args: Args, key: VerifiedMcpKey): Promise<ToolResult> {
	const jobs = await listProfileJobs(key.profileId, {
		limit: argInt(args, 'limit') ?? undefined,
		editableOnly: args.editable_only === true
	});

	if (jobs.length === 0) {
		return ok(
			args.editable_only === true
				? 'None of their jobs were entered by hand, so none can be changed.'
				: 'They have no jobs yet.',
			{ jobs }
		);
	}

	return ok(
		jobs
			.map(
				(job) =>
					`- [${job.id}] ${job.title ?? 'Untitled'}${job.company ? ` — ${job.company}` : ''}` +
					`${job.editable ? '' : ' (read-only: imported, not hand-entered)'}`
			)
			.join('\n'),
		{ jobs }
	);
}

/**
 * What the write tools for one row would be patching, read from the write tools.
 *
 * A read tool's promise is "the current value of every field you are allowed to
 * write", and the capabilities are where that list is declared — one map per
 * capability driving the prompt, the JSON Schema, the coercion and the write.
 * Spelling the same columns out again in a read query is how the two come to
 * disagree, which is a whole genre of bug this repository has already paid for.
 * So a field appears here because a capability writes it, or it does not appear.
 */
async function currentFields(
	capabilities: Capability[],
	target: CapabilityTarget,
	actor: CapabilityActor
): Promise<Record<string, unknown>> {
	const states = await Promise.all(
		capabilities.map((capability) => CAPABILITIES[capability].current(target, actor))
	);
	return Object.assign({}, ...states);
}

/** `name: value` over whatever a capability's `current` returned. */
function renderFields(fields: Record<string, unknown>): string {
	return Object.entries(fields)
		.map(([name, value]) => {
			const rendered = Array.isArray(value)
				? value.join(', ')
				: value === null || value === undefined || value === ''
					? '(not set)'
					: String(value);
			return `${name}: ${rendered}`;
		})
		.join('\n');
}

async function readJob(args: Args, key: VerifiedMcpKey): Promise<ToolResult> {
	const id = argInt(args, 'job_id');
	if (id === null) return fail('job_id is required. Call list_jobs for the ids.');

	const job = await readProfileJob(id, key.profileId);
	// The same answer for a job that does not exist and one this profile cannot
	// reach. Telling them apart is how the id space gets walked.
	if (!job) {
		return fail(
			`There is no job ${id} in this applicant's jobs. Call list_jobs — this key ` +
				`reaches the jobs they imported or applied to, and nothing else.`
		);
	}

	const actor: CapabilityActor = { profileId: key.profileId, isStaff: false };
	const target: CapabilityTarget = { id: job.id, label: job.title ?? 'Untitled' };
	const fields = await currentFields(JOB_CAPABILITIES, target, actor);

	return ok(
		`Job ${job.id}${job.editable ? '' : ' (read-only: imported, not hand-entered)'}:\n\n` +
			renderFields(fields),
		{ job, fields }
	);
}

async function listApplications(args: Args, key: VerifiedMcpKey): Promise<ToolResult> {
	const applications = await listProfileApplications(key.profileId, {
		limit: argInt(args, 'limit') ?? undefined,
		status: typeof args.status === 'string' ? args.status : undefined
	});

	if (applications.length === 0) {
		return ok(
			typeof args.status === 'string'
				? `No applications with status "${args.status}".`
				: 'They have no applications yet.',
			{ applications }
		);
	}

	return ok(
		applications
			.map(
				(app) =>
					`- [${app.id}] ${app.job_title ?? 'Untitled'}` +
					`${app.job_company ? ` at ${app.job_company}` : ''} — ${app.status}` +
					`${app.job_id === null ? '' : ` (job ${app.job_id})`}`
			)
			.join('\n'),
		{ applications }
	);
}

async function readApplication(args: Args, key: VerifiedMcpKey): Promise<ToolResult> {
	const id = argInt(args, 'application_id');
	if (id === null) return fail('application_id is required. Call list_applications for the ids.');

	const application = await readProfileApplication(id, key.profileId);
	if (!application) {
		return fail(`There is no application ${id} on this profile. Call list_applications.`);
	}

	const actor: CapabilityActor = { profileId: key.profileId, isStaff: false };
	const target: CapabilityTarget = { id: application.id, label: application.job_title ?? '' };
	const details = CAPABILITIES.edit_application_details;
	const activity = CAPABILITIES.add_activity_record;

	const fields = await details.current(target, actor);
	const logged = await activity.current(target, actor);

	// The chronology rendered by the capability that writes into it, rather than
	// by a second copy here. It already has to tell a model not to log the same
	// thing twice — that instruction belongs next to the contract that says what
	// an entry is, and having said it twice in two wordings is how one goes stale.
	const chronology = activity.renderState?.(logged) ?? renderFields(logged);

	return ok(
		`Application ${application.id} — ${application.job_title ?? 'Untitled'}` +
			`${application.job_company ? ` at ${application.job_company}` : ''}\n` +
			`status: ${application.status}${application.status_step ? ` (${application.status_step})` : ''}\n\n` +
			`${renderFields(fields)}\n\n${chronology}`,
		{ application, fields, ...logged }
	);
}

/* ------------------------------------------------------------------ *
 * Writes
 * ------------------------------------------------------------------ */

/**
 * The row a write names, resolved without trusting the id it was given.
 *
 * Two shapes, because the two families of capability are addressed differently:
 *
 * - A **job or an application** is named by its own id, resolved through
 *   `entities.ts` against what this profile can reach. That module also refuses
 *   an unedittable job here rather than at the gate, so the agent is told it
 *   never could rather than that it no longer can.
 * - A **profile section row** is found by listing the section's rows and
 *   matching the id among them — `resolveMany` rather than a read by id, so an
 *   MCP call can only reach rows the registry would already have offered.
 *
 * `executeCapability` re-authorizes on the far side of both. This is about not
 * building a second way in, never about being the only check.
 */
async function resolveTarget(
	capability: Capability,
	args: Args,
	actor: CapabilityActor
): Promise<{ target: CapabilityTarget } | { error: string }> {
	const def = CAPABILITIES[capability];
	const targeting = targetingFor(capability);

	if (targeting) {
		const id = argInt(args, targeting.arg);
		if (id === null) {
			return { error: `${targeting.arg} is required. Call ${targeting.listTool} to find it.` };
		}
		return targeting.resolve(id, actor);
	}

	if (capability.startsWith('add_')) {
		const target = await def.resolve(null, actor);
		return target ? { target } : { error: 'That section cannot be added to right now.' };
	}

	const entryId = argInt(args, 'entry_id');
	if (entryId === null) {
		return { error: 'entry_id is required. Call read_profile_section to find it.' };
	}

	const candidates = (await def.resolveMany?.(null, actor)) ?? [];
	const target = candidates.find((row) => row.id === entryId);
	if (!target) {
		return {
			error:
				`There is no entry ${entryId} in ${sectionFor(capability)} on this profile. ` +
				`Call read_profile_section for the current ids.`
		};
	}

	return { target };
}

/** `before → after`, for the field values that are actually changing. */
function renderDiff(
	previous: Record<string, unknown>,
	fields: Record<string, unknown>
): { text: string; diff: Record<string, { before: unknown; after: unknown }> } {
	const diff: Record<string, { before: unknown; after: unknown }> = {};
	for (const [name, after] of Object.entries(fields)) {
		diff[name] = { before: previous[name] ?? null, after };
	}

	const lines = Object.entries(diff).map(([name, { before, after }]) => {
		const from =
			before === null || before === undefined || before === '' ? '(empty)' : String(before);
		const to = after === null || after === undefined || after === '' ? '(cleared)' : String(after);
		return `  ${name}:\n    before: ${from}\n    after:  ${to}`;
	});

	return { text: lines.join('\n'), diff };
}

async function runWrite(
	capability: Capability,
	args: Args,
	key: VerifiedMcpKey
): Promise<ToolResult> {
	const actor: CapabilityActor = { profileId: key.profileId, isStaff: false };
	const def = CAPABILITIES[capability];

	const resolved = await resolveTarget(capability, args, actor);
	if ('error' in resolved) return fail(resolved.error);
	const { target } = resolved;

	const current = await def.current(target, actor);
	const fields = pickCapabilityFields(capability, args);

	if (Object.keys(def.fields).length > 0 && Object.keys(fields).length === 0) {
		return fail(
			`No recognised fields. This tool writes: ${Object.keys(def.fields).join(', ')} — ` +
				`use the full names including the prefix.`
		);
	}

	// Validated before the tier is decided, so a malformed request is answered as
	// malformed rather than queued for a person to read and reject.
	const valid = def.validate(fields, current);
	if (!valid.ok) return fail(valid.error);

	const rationale = typeof args.rationale === 'string' ? args.rationale.trim() : '';
	if (!rationale) {
		return fail('rationale is required — the applicant reads it when deciding.');
	}

	const alreadyWritten = await recentDirectWrites(key.profileId);
	const decision = tierForWrite({
		capability,
		current,
		fields,
		recentDirectWrites: alreadyWritten
	});
	const disposition = dispositionFor(decision.tier, key.scope);

	if (disposition === 'refused') {
		return fail(
			`This key is read-only, so it cannot change anything. Its scope is set on the ` +
				`applicant's MCP keys page.`
		);
	}

	// Only the fields being written, matching what `executeCapability` records as
	// its before-image, so a request's diff and an edit's undo describe the same
	// thing.
	const previous = Object.fromEntries(
		Object.keys(fields)
			.filter((name) => name in current)
			.map((name) => [name, current[name]])
	);

	if (disposition === 'request') {
		const requestId = await createRequest({
			profileId: key.profileId,
			source: 'mcp',
			mcpKeyId: key.keyId,
			capability,
			target,
			fields,
			previous: def.beforeImage ? await def.beforeImage(target, current, actor) : previous,
			rationale
		});

		await notifyRequest(key, capability, target, requestId);

		const { text, diff } = renderDiff(previous, fields);
		const link = requestPath(requestId);

		return ok(
			`Not applied — this needs the applicant's approval. ${decision.reason}\n\n` +
				`Asked to ${def.title.toLowerCase()} on "${target.label}".\n` +
				(text ? `\n${text}\n` : '') +
				`\nThey decide at ${link}. There is no way for you to approve it; ` +
				`tell them it is waiting and carry on.`,
			{
				applied: false,
				request_id: requestId,
				review_at: link,
				reason: decision.reason,
				target: target.label,
				diff
			}
		);
	}

	const outcome = await executeCapability(capability, target, actor, fields, 'mcp');
	if (!outcome.ok) return fail(outcome.error);

	// Tier 1 is the tier that writes with nobody watching, so the applicant is
	// told an agent has started — once per window, on the first one, rather than
	// per write. A notification per add would be twenty of them for a session's
	// work, and twenty notifications is the same as none.
	if (alreadyWritten === 0) {
		await notify(key, {
			title: 'A connected app is changing your profile',
			message:
				`${key.name} started making changes directly — it began with ` +
				`"${def.title.toLowerCase()}" on "${target.label}".`,
			link: '/data/ai-changes'
		});
	}

	const { text, diff } = renderDiff(outcome.previous, fields);
	// A section has one page for its whole list; a job or an application has one
	// per row, and only the resolved target knows which row.
	const targeting = targetingFor(capability);
	const page = targeting ? targeting.page(target.id) : pageFor(capability);

	// How they take it back, which is not the same question for both verbs. An
	// edit is undoable from the feed, because only its before-image has what it
	// replaced. An add is not — the registry has no delete, deliberately — so the
	// honest answer is the page with the delete button on it. Telling an agent to
	// send them to an Undo that is not there is worse than saying nothing.
	const reversal = def.revert
		? `The applicant can undo this from /data/ai-changes (change ${outcome.editId}).`
		: page
			? `They can remove it again from their ${page.name} page (${page.path}).`
			: '';

	return ok(
		`Applied to "${target.label}".\n` +
			(text ? `\n${text}\n` : '') +
			`\n${reversal} Tell them you made it.`.replace('  ', ' '),
		{
			applied: true,
			change_id: outcome.editId,
			undoable: !!def.revert,
			target: target.label,
			diff
		}
	);
}

/**
 * Tap the applicant on the shoulder.
 *
 * Best-effort by design: a notification that fails must not fail the write or
 * the request it describes, both of which are already recorded and already
 * visible in the feed. The row is the record; this is only the prompt to go and
 * look at it.
 *
 * Every message names the *credential* — the name the applicant typed when they
 * connected the app. Nothing an agent says about itself appears here: its
 * rationale is shown on the approval card, where it reads as a claim being
 * weighed, rather than in a notification, where it would read as this
 * application talking.
 */
async function notify(
	key: VerifiedMcpKey,
	opts: { title: string; message: string; link: string }
): Promise<void> {
	try {
		await createNotification({ userId: key.userId, type: 'capability_request', ...opts });
	} catch (e) {
		console.error('[mcp] change recorded but the applicant was not notified', e);
	}
}

function notifyRequest(
	key: VerifiedMcpKey,
	capability: Capability,
	target: CapabilityTarget,
	requestId: number
): Promise<void> {
	return notify(key, {
		title: 'An agent wants to change your profile',
		message: `${key.name} asked to ${CAPABILITIES[capability].title.toLowerCase()} on "${target.label}".`,
		link: requestPath(requestId)
	});
}

/* ------------------------------------------------------------------ *
 * Entry point
 * ------------------------------------------------------------------ */

export async function callTool(name: string, args: Args, key: VerifiedMcpKey): Promise<ToolResult> {
	if (name === 'list_profile_sections') {
		// The only tool that does not take a profile_id, because it is how an agent
		// learns which one it has. Requiring it here would be a chicken-and-egg.
		return listProfileSections(key);
	}

	const mismatch = profileMismatch(args, key);
	if (mismatch) return mismatch;

	if (isReadTool(name)) {
		switch (name) {
			case 'read_profile_section':
				return readProfileSection(args, key);
			case 'list_jobs':
				return listJobs(args, key);
			case 'read_job':
				return readJob(args, key);
			case 'list_applications':
				return listApplications(args, key);
			case 'read_application':
				return readApplication(args, key);
			case 'list_changes':
				return listChanges(args, key);
			default:
				return listPendingChanges(key);
		}
	}

	if (!isMcpCapability(name)) {
		return fail(`No tool named "${name}".`);
	}

	if (key.scope === 'read') {
		return fail(
			`This key is read-only, so it cannot change anything. Its scope is set on the ` +
				`applicant's MCP keys page.`
		);
	}

	return runWrite(name, args, key);
}
