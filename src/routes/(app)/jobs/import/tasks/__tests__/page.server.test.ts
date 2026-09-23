/**
 * Tests for the import-task create action's device check.
 *
 * A task can pair a credential a contact shared with one of the devices
 * (sjs-browser API keys) the user can reach. The rule is the one the PATCH
 * endpoint enforces: a shared credential only runs on a device its owner owns.
 * Create applies it quietly, dropping a device that fails it so the user can
 * re-pick one on the detail page, rather than refusing the task.
 *
 * The owner lookup used to ask `api_keys` for a `profile` relation, which it
 * lost when devices moved to user-wide ownership. Drizzle does not check `with`
 * keys against the relations, so building that query threw a TypeError and
 * every create on this path was a 500. svelte-check reported it the whole time,
 * inside the tolerated backlog. The mocks below answer with the columns the
 * real query selects, so reading a relation that is not there fails here too.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const USER = 'user-1';
const CONTACT = 'contact-7';
const DEVICE = 9;

const mockPlatformFindFirst = vi.fn();
const mockCredentialFindFirst = vi.fn();
const mockPlatformProfileFindFirst = vi.fn();
const mockApiKeyFindFirst = vi.fn();
const mockHasDeviceAccess = vi.fn();
const mockValues = vi.fn((_values: Record<string, unknown>) => ({
	returning: () => Promise.resolve([{ id: 501 }])
}));

vi.mock('$lib/server/db', () => {
	const handle = {
		query: {
			job_platforms: { findFirst: (...a: unknown[]) => mockPlatformFindFirst(...a) },
			platform_credentials: { findFirst: (...a: unknown[]) => mockCredentialFindFirst(...a) },
			platform_profiles: { findFirst: (...a: unknown[]) => mockPlatformProfileFindFirst(...a) },
			api_keys: { findFirst: (...a: unknown[]) => mockApiKeyFindFirst(...a) }
		},
		insert: () => ({ values: mockValues })
	};
	return { db: handle, dbDirect: handle };
});

vi.mock('drizzle-orm', () => ({
	and: (...a: unknown[]) => a,
	asc: (c: unknown) => c,
	desc: (c: unknown) => c,
	eq: (c: unknown, v: unknown) => [c, v],
	inArray: (c: unknown, v: unknown) => [c, v],
	isNotNull: (c: unknown) => c,
	or: (...a: unknown[]) => a
}));

vi.mock('$lib/server/db/schema', () => ({
	api_keys: { id: 'api_keys.id' },
	job_platforms: { id: 'job_platforms.id' },
	platform_credentials: {
		id: 'platform_credentials.id',
		platform_id: 'platform_credentials.platform_id'
	},
	platform_profiles: {
		id: 'platform_profiles.id',
		profile_id: 'platform_profiles.profile_id',
		platform_credential_id: 'platform_profiles.platform_credential_id'
	},
	profiles: { id: 'profiles.id' },
	search_tasks: {}
}));

vi.mock('$lib/server/config', () => ({
	config: { localBrowserAllowed: true, defaultBrowserProvider: null }
}));
vi.mock('$lib/server/auth/crypto', () => ({ encryptCredential: (v: unknown) => v }));
vi.mock('$lib/server/auth/api-key', () => ({ listApiKeys: vi.fn() }));
vi.mock('$lib/server/credential-shares', () => ({
	hasCredentialAccess: () => Promise.resolve(true)
}));
vi.mock('$lib/server/device-shares', () => ({
	hasDeviceAccess: (...a: unknown[]) => mockHasDeviceAccess(...a),
	listSharedWithMe: vi.fn()
}));
vi.mock('../../../../profile/utils', () => ({
	getSelectedProfileId: () => Promise.resolve(12)
}));

import { actions } from '../+page.server';

type CreateEvent = Parameters<NonNullable<typeof actions.create>>[0];

/** A create on an existing platform with credential 40 and device 9 picked. */
function createEvent(): CreateEvent {
	const fd = new FormData();
	fd.set('platform_id', '7');
	fd.set('credential_id', '40');
	fd.set('sjsbrowser_api_key', String(DEVICE));
	return {
		locals: { user: { id: USER } },
		cookies: {},
		request: { formData: async () => fd }
	} as unknown as CreateEvent;
}

/** Whose credential the task's platform_profiles row points at. */
function credentialOwnedBy(userId: string) {
	mockPlatformProfileFindFirst.mockResolvedValue({
		id: 55,
		platform_credential: { user_id: userId }
	});
}

/** The device the task was saved with. */
function savedDevice() {
	expect(mockValues).toHaveBeenCalledTimes(1);
	return mockValues.mock.calls[0][0].sjsbrowser_api_key;
}

describe('create action: device paired with a credential', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockPlatformFindFirst.mockResolvedValue({
			id: 7,
			name: 'LinkedIn',
			search_page_url: 'https://www.linkedin.com/jobs/',
			login_page_url: null,
			created_by_user_id: null
		});
		mockCredentialFindFirst.mockResolvedValue({ id: 40 });
		mockHasDeviceAccess.mockResolvedValue(true);
	});

	it('keeps a device that the shared credential’s owner owns', async () => {
		credentialOwnedBy(CONTACT);
		mockApiKeyFindFirst.mockResolvedValue({ id: DEVICE, user_id: CONTACT });

		const result = await actions.create!(createEvent());

		expect(result).toEqual({ success: true, taskId: 501 });
		expect(savedDevice()).toBe(DEVICE);
	});

	it('drops a device the shared credential’s owner does not own, and still saves', async () => {
		credentialOwnedBy(CONTACT);
		mockApiKeyFindFirst.mockResolvedValue({ id: DEVICE, user_id: USER });

		const result = await actions.create!(createEvent());

		expect(result).toEqual({ success: true, taskId: 501 });
		expect(savedDevice()).toBeNull();
	});

	it('keeps any reachable device with the user’s own credential, without an owner lookup', async () => {
		credentialOwnedBy(USER);

		await actions.create!(createEvent());

		expect(savedDevice()).toBe(DEVICE);
		expect(mockApiKeyFindFirst).not.toHaveBeenCalled();
	});
});
