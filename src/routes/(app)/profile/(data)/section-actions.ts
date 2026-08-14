/**
 * The form actions for a profile section, built from its declaration.
 *
 * Seven `+page.server.ts` files under this directory carried their own
 * create/update/delete/reorder actions. They were the same twenty lines each
 * time — resolve the user, resolve the selected profile, pull named strings out
 * of a `FormData`, check the one required field, insert or update, touch the
 * profile — differing only in which columns they named. The columns are already
 * written down in `PROFILE_RESOURCES`, so they are what drives this.
 *
 * What the sections genuinely disagree about is which actions they have and
 * where a create goes afterwards, and those are the options. Work experience,
 * education and side projects open the new row's detail page (there is more to
 * fill in); the shorter sections stay on the list. Work experience and side
 * projects reorder here; languages, references and certificates reorder through
 * the API, because their lists drag-and-drop without a form post.
 *
 * A field the form does not post is left alone rather than cleared —
 * `formData.has` is the difference between "not mentioned" and "emptied", and
 * collapsing the two is how a partial save wipes the fields it never showed.
 */

import { fail, redirect, type Actions, type Cookies, type RequestEvent } from '@sveltejs/kit';
import { getSelectedProfileId } from '$lib/server/profile/selected-profile';
import {
	createRow,
	deleteRow,
	reorderRows,
	resetRowOrder,
	resourceFor,
	updateRow,
	type ProfileActor,
	type WriteRefusal
} from '$lib/server/profile/write';
import type { ProfileResourceName } from '$lib/server/profile/resources';

type ActionEvent = Pick<RequestEvent, 'request' | 'locals' | 'cookies'>;

/**
 * Resolve who is writing, or the failure to return instead.
 *
 * The selected-profile cookie is checked against the user before it is
 * believed, so what comes back is a profile the caller demonstrably owns —
 * which is the whole of what the write layer authorizes against.
 */
async function resolveActor(
	locals: App.Locals,
	cookies: Cookies
): Promise<{ actor: ProfileActor } | { failure: ReturnType<typeof fail> }> {
	const user = locals.user;
	if (!user) return { failure: fail(401, { error: 'Not authenticated' }) };

	const profileId = await getSelectedProfileId(cookies, user.id);
	if (!profileId) return { failure: fail(400, { error: 'No profile selected' }) };

	return { actor: { profileId } };
}

/**
 * The form half of the write layer's refusal mapping.
 *
 * A row that belongs to another profile is reported as missing, not as
 * forbidden — that is what these actions have always said, and it is the right
 * answer: the applicant has no way to reach a row that isn't theirs, so being
 * told one exists is information they cannot use and shouldn't have.
 */
function failWrite(reason: WriteRefusal, error: string) {
	if (reason === 'invalid') return fail(400, { error });
	return fail(404, { error });
}

function parseId(formData: FormData): number | null {
	const id = parseInt(formData.get('id') as string, 10);
	return Number.isNaN(id) ? null : id;
}

/** Pull the resource's declared fields out of a form post, skipping the ones it didn't send. */
function fieldsFromForm(resource: ProfileResourceName, formData: FormData) {
	const input: Record<string, unknown> = {};
	for (const field of Object.keys(resourceFor(resource).fields)) {
		if (formData.has(field)) input[field] = formData.get(field);
	}
	return input;
}

export interface SectionActionOptions {
	/** Where a successful create sends the browser; omit to stay on the list. */
	createdPath?: (id: number) => string;
	/** The actions this section exposes. */
	include: ReadonlyArray<'create' | 'update' | 'delete' | 'reorder' | 'resetOrder'>;
}

export function sectionActions(
	resource: ProfileResourceName,
	options: SectionActionOptions
): Actions {
	const { label } = resourceFor(resource);
	const wanted = new Set(options.include);
	const actions: Actions = {};

	if (wanted.has('create')) {
		actions.create = async ({ request, locals, cookies }: ActionEvent) => {
			const resolved = await resolveActor(locals, cookies);
			if ('failure' in resolved) return resolved.failure;

			const formData = await request.formData();
			const result = await createRow(resource, resolved.actor, fieldsFromForm(resource, formData));
			if (!result.ok) return failWrite(result.reason, result.error);

			if (options.createdPath) redirect(302, options.createdPath(result.id));
			return { success: true };
		};
	}

	if (wanted.has('update')) {
		actions.update = async ({ request, locals, cookies }: ActionEvent) => {
			const resolved = await resolveActor(locals, cookies);
			if ('failure' in resolved) return resolved.failure;

			const formData = await request.formData();
			const id = parseId(formData);
			if (id === null) return fail(400, { error: `Invalid ${label} ID` });

			const result = await updateRow(
				resource,
				resolved.actor,
				id,
				fieldsFromForm(resource, formData)
			);
			if (!result.ok) return failWrite(result.reason, result.error);

			return { success: true };
		};
	}

	if (wanted.has('delete')) {
		actions.delete = async ({ request, locals, cookies }: ActionEvent) => {
			const resolved = await resolveActor(locals, cookies);
			if ('failure' in resolved) return resolved.failure;

			const formData = await request.formData();
			const id = parseId(formData);
			if (id === null) return fail(400, { error: `Invalid ${label} ID` });

			const result = await deleteRow(resource, resolved.actor, id);
			if (!result.ok) return failWrite(result.reason, result.error);

			return { success: true };
		};
	}

	if (wanted.has('reorder')) {
		actions.reorder = async ({ request, locals, cookies }: ActionEvent) => {
			const resolved = await resolveActor(locals, cookies);
			if ('failure' in resolved) return resolved.failure;

			const formData = await request.formData();
			let order: unknown;
			try {
				order = JSON.parse(formData.get('order') as string);
			} catch {
				return fail(400, { error: 'Invalid order' });
			}
			if (!Array.isArray(order)) return fail(400, { error: 'Invalid order' });

			await reorderRows(resource, resolved.actor, order.map(Number));
			return { success: true };
		};
	}

	if (wanted.has('resetOrder')) {
		actions.resetOrder = async ({ locals, cookies }: ActionEvent) => {
			const resolved = await resolveActor(locals, cookies);
			if ('failure' in resolved) return resolved.failure;

			await resetRowOrder(resource, resolved.actor);
			return { success: true };
		};
	}

	return actions;
}
