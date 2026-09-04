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
		search_page_url: 'https://www.linkedin.com/jobs/search/'
	}
];

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
	async function pickOtherSite(container: HTMLElement) {
		const select = screen.getByLabelText('Site') as HTMLSelectElement;
		const other = screen
			.getAllByRole('option')
			.find((o) => /Other site/.test(o.textContent ?? '')) as HTMLOptionElement;
		await fireEvent.change(select, { target: { value: other.value } });
		return container;
	}

	async function fill(label: RegExp, value: string) {
		await fireEvent.input(screen.getByLabelText(label), { target: { value } });
	}

	test('asks for a search URL, a login page and keywords', async () => {
		const container = renderForm(null);
		await pickOtherSite(container);

		expect(screen.getByLabelText(/Job search URL/)).toBeDefined();
		expect(screen.getByLabelText(/Login page URL/)).toBeDefined();
		// The keyword box used to be hidden for custom sites, on the assumption
		// that a pasted URL already carried the search.
		expect(screen.getByLabelText(/Search keywords/)).toBeDefined();
	});

	test('sends the URLs and keywords the user typed', async () => {
		const container = renderForm(null);
		await pickOtherSite(container);
		await fill(/Job search URL/, 'https://acme.example.com/jobs');
		await fill(/Login page URL/, 'https://acme.example.com/login');
		await fill(/Search keywords/, 'python developer');

		expect(hiddenValue(container, 'platform_is_new')).toBe('true');
		expect(hiddenValue(container, 'platform_url')).toBe('https://acme.example.com');
		expect(hiddenValue(container, 'search_url')).toBe('https://acme.example.com/jobs');
		expect(hiddenValue(container, 'login_page_url')).toBe('https://acme.example.com/login');
		expect(hiddenValue(container, 'search_term')).toBe('python developer');
	});

	test('switches to manual login when a login page is given', async () => {
		const container = renderForm(null);
		await pickOtherSite(container);
		await fill(/Job search URL/, 'https://acme.example.com/jobs');
		await fill(/Login page URL/, 'https://acme.example.com/login');

		// "none" makes the scraper skip the login phase outright, so the URL
		// would be stored and never visited. This form collects no password,
		// so "manual" (pause and hand over the browser) is the only mode that
		// can actually use it.
		expect(hiddenValue(container, 'login_mode')).toBe('manual');
	});

	test('leaves login off when no login page is given', async () => {
		const container = renderForm(null);
		await pickOtherSite(container);
		await fill(/Job search URL/, 'https://acme.example.com/jobs');

		expect(hiddenValue(container, 'login_mode')).toBe('none');
	});

	test('refuses to submit a login URL that is not absolute', async () => {
		const container = renderForm(null);
		await pickOtherSite(container);
		await fill(/Job search URL/, 'https://acme.example.com/jobs');
		await fill(/Login page URL/, 'acme.example.com/login');

		expect(screen.getByText(/Enter a full URL including https/)).toBeDefined();
		const submit = screen.getByRole('button', { name: /Add Task/ }) as HTMLButtonElement;
		expect(submit.disabled).toBe(true);
	});
});
