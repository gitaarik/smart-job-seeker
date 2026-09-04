import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/svelte';
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
	// browser. These lock in the reconciler's rule instead: a connected device
	// wins, and the server default applies only when there is none.
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
