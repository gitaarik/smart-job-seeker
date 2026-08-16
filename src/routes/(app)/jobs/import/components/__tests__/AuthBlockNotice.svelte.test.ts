import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import AuthBlockNotice from '../AuthBlockNotice.svelte';

// Cleanup between renders comes from vitest.setup.client.ts — see that file
// for why the client project needs it at all.

const BASE = {
	kind: 'auth_verification',
	platform: 'LinkedIn',
	taskLabel: 'Senior TypeScript'
};

describe('AuthBlockNotice', () => {
	test('tells a backed-off task apart from a switched-off one', () => {
		// The two states need different things from the user — one is still
		// retrying, the other has stopped — and the row underneath looks
		// identical either way, so the heading is what carries the difference.
		const { unmount } = render(AuthBlockNotice, { ...BASE, disabled: false });
		expect(screen.getByText(/needs you once/i)).toBeTruthy();
		unmount();

		render(AuthBlockNotice, { ...BASE, disabled: true });
		expect(screen.getByText(/switched off/i)).toBeTruthy();
	});

	test('shows the remedy rather than restating the failure', () => {
		// The task row already says "Platform login failed". This component
		// exists to answer the question that raises — what do I do about it —
		// so it drops the opening paragraph and renders the advice.
		render(AuthBlockNotice, BASE);
		expect(screen.getByText(/Run now/)).toBeTruthy();
		expect(screen.getByText(/remembers the device/)).toBeTruthy();
	});

	test('gives the credentials case its own advice', () => {
		// A rejected password is fixed by editing stored credentials, not by
		// running the task and completing a check in a browser. Sending someone
		// to the wrong remedy is worse than saying nothing.
		render(AuthBlockNotice, { ...BASE, kind: 'auth_credentials' });
		expect(screen.getByText(/stored credentials/)).toBeTruthy();
		expect(screen.queryByText(/Run now/)).toBeNull();
	});

	test('renders nothing when the task is not blocked', () => {
		// The parent guards on auth_block_kind, but a null kind must not render
		// an empty amber box if that guard is ever relaxed.
		const { container } = render(AuthBlockNotice, { ...BASE, kind: null });
		expect(container.textContent?.trim()).toBe('');
	});

	test('renders nothing for a kind it does not recognise', () => {
		// Kinds are append-only and read from a varchar column, so a row written
		// by a newer version can arrive here. Falling back to an empty render
		// beats rendering advice derived from a kind we cannot interpret.
		const { container } = render(AuthBlockNotice, {
			...BASE,
			kind: 'auth_something_from_the_future'
		});
		expect(container.textContent?.trim()).toBe('');
	});
});
