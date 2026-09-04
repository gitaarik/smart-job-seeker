import { describe, expect, test } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import SimplifiedAddTaskForm, {
	type ImportablePlatform,
	type PreferredDevice
} from '../SimplifiedAddTaskForm.svelte';

const platforms: ImportablePlatform[] = [
	{
		id: 16,
		key: 'linkedin',
		name: 'LinkedIn',
		url: 'https://www.linkedin.com/',
		search_page_url: 'https://www.linkedin.com/jobs/search/',
		login_page_url: 'https://www.linkedin.com/login'
	},
	{
		id: 21,
		key: 'remoteok',
		name: 'RemoteOK',
		url: 'https://remoteok.com/',
		search_page_url: 'https://remoteok.com/remote-dev-jobs',
		login_page_url: null
	}
];

async function pickPlatform(name: string) {
	const input = screen.getByLabelText('Site');
	await fireEvent.focus(input);
	await fireEvent.input(input, { target: { value: name } });
	const option = screen.getAllByRole('option').find((o) => o.textContent?.includes(name));
	await fireEvent.click(option!);
}

function ownDevice(overrides: Partial<PreferredDevice> = {}): PreferredDevice {
	return {
		apiKeyId: 42,
		apiKeyName: 'NAS',
		isShared: false,
		ownerLabel: null,
		...overrides
	};
}

function renderForm(
	preferredDevice: PreferredDevice | null,
	deviceStatusChecked = true
): HTMLElement {
	const { container } = render(SimplifiedAddTaskForm, {
		platforms,
		defaultMaxJobs: 25,
		preferredDevice,
		deviceStatusChecked,
		onCancel: () => {}
	});
	return container as HTMLElement;
}

function hiddenValue(container: HTMLElement, name: string): string | null {
	const el = container.querySelector<HTMLInputElement>(`input[type="hidden"][name="${name}"]`);
	return el ? el.value : null;
}

describe('SimplifiedAddTaskForm — where the task runs', () => {
	// The form used to hardcode browser_provider="hosted", so a user with a
	// device connected still had every manually-added task sent to the cloud
	// browser. These lock in the rule instead: a connected device wins, and the
	// server default applies only when there is none.
	test('pins the task to a connected device', () => {
		const container = renderForm(ownDevice());

		expect(hiddenValue(container, 'browser_provider')).toBe('tunnel');
		expect(hiddenValue(container, 'sjsbrowser_api_key')).toBe('42');
	});

	test('defers to the server default when no device is connected', () => {
		const container = renderForm(null);

		// Empty rather than "hosted": the create action resolves its own default,
		// so the row is not pinned to a provider the operator may later change.
		expect(hiddenValue(container, 'browser_provider')).toBe('');
		expect(hiddenValue(container, 'sjsbrowser_api_key')).toBeNull();
	});

	test('uses a shared device the same way as an own one', () => {
		const container = renderForm(
			ownDevice({ apiKeyId: 7, apiKeyName: "Rik's NAS", isShared: true, ownerLabel: 'Rik' })
		);

		expect(hiddenValue(container, 'browser_provider')).toBe('tunnel');
		expect(hiddenValue(container, 'sjsbrowser_api_key')).toBe('7');
		expect(screen.getByText(/shared by Rik/)).toBeDefined();
	});

	test('names the device it will run on', () => {
		renderForm(ownDevice());
		expect(screen.getByText(/Runs on NAS/)).toBeDefined();
	});

	test('says it will use the cloud browser when there is no device', () => {
		renderForm(null);
		expect(screen.getByText(/Runs on our cloud browser/)).toBeDefined();
	});

	test('does not claim a destination before the status check resolves', () => {
		renderForm(null, false);

		expect(screen.getByText(/Checking for a connected device/)).toBeDefined();
		expect(screen.queryByText(/Runs on our cloud browser/)).toBeNull();
	});
});

describe('SimplifiedAddTaskForm — adding a site we do not have yet', () => {
	async function pickOtherSite(container: HTMLElement, typed = '') {
		const input = screen.getByLabelText('Site');
		await fireEvent.focus(input);
		if (typed) await fireEvent.input(input, { target: { value: typed } });
		const create = screen
			.getAllByRole('option')
			.find((o) => /Add .*(new site|site we don)/.test(o.textContent ?? ''));
		await fireEvent.click(create!);
		return container;
	}

	async function fill(label: RegExp, value: string) {
		await fireEvent.input(screen.getByLabelText(label), { target: { value } });
	}

	test('starts with nothing chosen and will not submit until it is', () => {
		// The old <select> opened on the first platform with a search page,
		// which is Turing here: a default nobody picked, on a site that has
		// never returned a job.
		const container = renderForm(null);

		expect((screen.getByLabelText('Site') as HTMLInputElement).value).toBe('');
		expect(hiddenValue(container, 'platform_id')).toBeNull();
		expect((screen.getByRole('button', { name: /Add Task/ }) as HTMLButtonElement).disabled).toBe(
			true
		);
	});

	test('asks for a search URL and keywords, and nothing about signing in', async () => {
		const container = renderForm(null);
		await pickOtherSite(container);

		expect(screen.getByLabelText(/Job search URL/)).toBeDefined();
		// The keyword box used to be hidden for custom sites, on the assumption
		// that a pasted URL already carried the search.
		expect(screen.getByLabelText(/Search keywords/)).toBeDefined();
		// The login-page field was the wrong question at the wrong time: on its
		// own it does nothing, and at add time the user rarely knows the answer.
		expect(screen.queryByLabelText(/Login page URL/)).toBeNull();
	});

	test('sends the URL and keywords the user typed, and no login page', async () => {
		const container = renderForm(null);
		await pickOtherSite(container);
		await fill(/Job search URL/, 'https://acme.example.com/jobs');
		await fill(/Search keywords/, 'python developer');

		expect(hiddenValue(container, 'platform_is_new')).toBe('true');
		expect(hiddenValue(container, 'platform_url')).toBe('https://acme.example.com');
		expect(hiddenValue(container, 'search_url')).toBe('https://acme.example.com/jobs');
		expect(hiddenValue(container, 'search_term')).toBe('python developer');
		expect(hiddenValue(container, 'login_page_url')).toBeNull();
	});

	test('leaves login off for a site we know nothing about yet', async () => {
		const container = renderForm(null);
		await pickOtherSite(container);
		await fill(/Job search URL/, 'https://acme.example.com/jobs');

		expect(hiddenValue(container, 'login_mode')).toBe('none');
	});

	test('carries a typed host into the search URL', async () => {
		// Searching for a board we do not have should be the first step of
		// adding it, not a dead end the user retypes their way out of.
		const container = renderForm(null);
		await pickOtherSite(container, 'acme.example.com/jobs');

		expect((screen.getByLabelText(/Job search URL/) as HTMLInputElement).value).toBe(
			'https://acme.example.com/jobs'
		);
	});

	test('carries a typed name into the site name, not the URL', async () => {
		const container = renderForm(null);
		await pickOtherSite(container, 'Acme Careers');

		expect((screen.getByLabelText(/Site name/) as HTMLInputElement).value).toBe('Acme Careers');
		expect((screen.getByLabelText(/Job search URL/) as HTMLInputElement).value).toBe('');
	});

	test('keeps a URL the user already typed when the picker is reopened', async () => {
		const container = renderForm(null);
		await pickOtherSite(container);
		await fill(/Job search URL/, 'https://acme.example.com/jobs');
		await pickOtherSite(container, 'somewhere.else.com');

		expect((screen.getByLabelText(/Job search URL/) as HTMLInputElement).value).toBe(
			'https://acme.example.com/jobs'
		);
	});

	test('refuses to submit a search URL that is not absolute', async () => {
		const container = renderForm(null);
		await pickOtherSite(container);
		await fill(/Job search URL/, 'acme.example.com/jobs');

		expect(screen.getByText(/Enter a full URL including https/)).toBeDefined();
		const submit = screen.getByRole('button', { name: /Add Task/ }) as HTMLButtonElement;
		expect(submit.disabled).toBe(true);
	});
});

describe('SimplifiedAddTaskForm — sites that ask you to sign in', () => {
	// The form pinned login_mode="none" for everything picked from the
	// dropdown, so a LinkedIn task could never log in, no blocker mentioned it,
	// and the run came back empty.
	test('a gated platform gets a task that will sign in', async () => {
		const container = renderForm(null);
		await pickPlatform('LinkedIn');

		expect(hiddenValue(container, 'platform_id')).toBe('16');
		expect(hiddenValue(container, 'login_mode')).toBe('manual');
	});

	test('says so, rather than asking a question the user cannot answer yet', async () => {
		renderForm(null);
		await pickPlatform('LinkedIn');

		expect(screen.getByText(/LinkedIn asks you to sign in/)).toBeDefined();
		expect(screen.queryByLabelText(/Login page URL/)).toBeNull();
	});

	test('stays out of the way on a public board', async () => {
		const container = renderForm(null);
		await pickPlatform('RemoteOK');

		expect(hiddenValue(container, 'login_mode')).toBe('none');
		expect(screen.queryByText(/asks you to sign in/)).toBeNull();
	});
});
