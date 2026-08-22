import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	autoSaveField,
	diffPayload,
	flushPendingSaves,
	hasPendingSaves,
	patchBody
} from './auto-save.svelte';

/**
 * These run in the "client" vitest project (jsdom + browser resolve condition)
 * because the helper uses runes. `autoSaveField` is called outside component
 * init here, so its onDestroy hook is a no-op and every test tears its field
 * down explicitly — which also deregisters it from the module-level registry
 * that flushPendingSaves()/hasPendingSaves() read.
 */

/** A promise whose resolution the test controls, for interleaving saves. */
function deferred<T = void>() {
	let resolve!: (value: T) => void;
	let reject!: (err: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

/** Let queued microtasks (the awaits inside runSave) settle. */
const settle = () => Promise.resolve().then(() => {});

describe('autoSaveField', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('debounces and saves only the latest value', async () => {
		const save = vi.fn().mockResolvedValue(undefined);
		const field = autoSaveField({ initial: 'a', save, debounceMs: 700 });

		field.set('ab');
		field.set('abc');
		expect(save).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(700);
		expect(save).toHaveBeenCalledTimes(1);
		expect(save).toHaveBeenCalledWith('abc', 'a');
		expect(field.saved).toBe('abc');
		expect(field.status).toBe('saved');

		field.destroy();
	});

	it('flush() runs a pending save immediately', async () => {
		const save = vi.fn().mockResolvedValue(undefined);
		const field = autoSaveField({ initial: 'a', save, debounceMs: 700 });

		field.set('b');
		field.flush();
		await settle();

		expect(save).toHaveBeenCalledWith('b', 'a');
		field.destroy();
	});

	it("cancels the pending save when the value returns to what's saved", async () => {
		const save = vi.fn().mockResolvedValue(undefined);
		const field = autoSaveField({ initial: 'a', save, debounceMs: 700 });

		field.set('b');
		field.set('a');
		await vi.advanceTimersByTimeAsync(700);

		expect(save).not.toHaveBeenCalled();
		expect(field.dirty).toBe(false);
		field.destroy();
	});

	it('offers undo for the flash window, then posts the previous value back', async () => {
		const save = vi.fn().mockResolvedValue(undefined);
		const onSaved = vi.fn();
		const field = autoSaveField({
			initial: 'a',
			save,
			onSaved,
			savedFlashMs: 5000
		});

		field.set('b');
		await settle();
		expect(field.canUndo).toBe(true);
		expect(onSaved).toHaveBeenCalledWith('b');

		field.undo();
		await settle();
		expect(save).toHaveBeenLastCalledWith('a', 'b');
		expect(field.saved).toBe('a');
		expect(onSaved).toHaveBeenLastCalledWith('a');

		field.destroy();
	});

	it('drops back to idle after the flash window', async () => {
		const field = autoSaveField({
			initial: 'a',
			save: vi.fn().mockResolvedValue(undefined),
			savedFlashMs: 5000
		});

		field.set('b');
		await settle();
		expect(field.status).toBe('saved');

		await vi.advanceTimersByTimeAsync(5000);
		expect(field.status).toBe('idle');

		field.destroy();
	});

	it("keeps the user's value on failure and retries it", async () => {
		const save = vi.fn().mockRejectedValueOnce(new Error('nope')).mockResolvedValueOnce(undefined);
		const field = autoSaveField({ initial: 'a', save });

		field.set('b');
		await settle();
		expect(field.status).toBe('error');
		expect(field.error).toBe('nope');
		expect(field.value).toBe('b'); // no snap-back
		expect(field.saved).toBe('a');

		field.retry();
		await settle();
		expect(field.status).toBe('saved');
		expect(field.saved).toBe('b');

		field.destroy();
	});

	it('discards a stale save that resolves after a newer one', async () => {
		const slow = deferred();
		const fast = deferred();
		const save = vi.fn().mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise);
		const onSaved = vi.fn();
		const field = autoSaveField({ initial: 'a', save, onSaved });

		field.set('b'); // starts the slow save
		field.set('c'); // supersedes it
		await settle();

		fast.resolve();
		await settle();
		expect(field.saved).toBe('c');

		slow.resolve(); // late arrival from the superseded call
		await settle();
		expect(field.saved).toBe('c');
		expect(onSaved).toHaveBeenCalledTimes(1);
		expect(onSaved).toHaveBeenCalledWith('c');

		field.destroy();
	});

	it('re-runs when the value changed while a save was in flight', async () => {
		const inFlight = deferred();
		const save = vi.fn().mockReturnValueOnce(inFlight.promise).mockResolvedValue(undefined);
		const field = autoSaveField({ initial: 'a', save });

		field.set('b');
		inFlight.resolve();
		await settle();
		// "c" arrives while "b" is committing, so a catch-up save follows.
		field.set('c');
		await settle();

		expect(save).toHaveBeenLastCalledWith('c', 'b');
		expect(field.saved).toBe('c');

		field.destroy();
	});

	it('reset() re-seeds and invalidates an in-flight save', async () => {
		const inFlight = deferred();
		const save = vi.fn().mockReturnValue(inFlight.promise);
		const onSaved = vi.fn();
		const field = autoSaveField({ initial: 'a', save, onSaved });

		field.set('b');
		field.reset('z'); // e.g. navigating to a different record

		inFlight.resolve();
		await settle();

		expect(field.value).toBe('z');
		expect(field.saved).toBe('z');
		expect(field.status).toBe('idle');
		expect(onSaved).not.toHaveBeenCalled();

		field.destroy();
	});

	it('honours a custom equality fn', async () => {
		const save = vi.fn().mockResolvedValue(undefined);
		const field = autoSaveField<string | null>({
			initial: null,
			save,
			equal: (a, b) => (a ?? '') === (b ?? '')
		});

		field.set('');
		await settle();
		expect(save).not.toHaveBeenCalled(); // "" and null are the same value here

		field.destroy();
	});
});

describe('navigation guard helpers', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('flushes every live field and reports pending work', async () => {
		const saveA = vi.fn().mockResolvedValue(undefined);
		const saveB = vi.fn().mockResolvedValue(undefined);
		const a = autoSaveField({ initial: 'a', save: saveA, debounceMs: 700 });
		const b = autoSaveField({ initial: 'b', save: saveB, debounceMs: 700 });

		expect(hasPendingSaves()).toBe(false);

		a.set('a2');
		b.set('b2');
		expect(hasPendingSaves()).toBe(true);

		flushPendingSaves();
		await settle();

		expect(saveA).toHaveBeenCalledWith('a2', 'a');
		expect(saveB).toHaveBeenCalledWith('b2', 'b');
		expect(hasPendingSaves()).toBe(false);

		a.destroy();
		b.destroy();
	});

	it('stops tracking a field once it is destroyed', async () => {
		const save = vi.fn().mockResolvedValue(undefined);
		const field = autoSaveField({ initial: 'a', save, debounceMs: 700 });

		field.set('b');
		field.destroy();

		flushPendingSaves();
		await settle();

		expect(save).not.toHaveBeenCalled();
		expect(hasPendingSaves()).toBe(false);
	});
});

describe('patchBody', () => {
	it('carries the baseline for exactly the fields it is writing', () => {
		const prev = { name: 'a', stars: '155', summary: 'old' };
		const next = { name: 'a', stars: '154', summary: 'new' };

		expect(patchBody(next, prev)).toEqual({
			stars: '154',
			summary: 'new',
			expected: { stars: '155', summary: 'old' }
		});
	});

	it('does not claim a baseline for a field it is leaving alone', () => {
		// Claiming one would turn "someone edited a field I am not touching" into
		// a conflict, which is the check being wrong rather than the write.
		const body = patchBody({ name: 'a', url: 'CHANGED' }, { name: 'a', url: 'u' });

		expect(body).toEqual({ url: 'CHANGED', expected: { url: 'u' } });
		expect(body && 'name' in body.expected).toBe(false);
	});

	it('is null when nothing changed, so the caller keeps one early return', () => {
		const same = { name: 'a', stars: null };
		expect(patchBody({ ...same }, { ...same })).toBeNull();
	});
});

describe('diffPayload', () => {
	it('emits only the entries that changed', () => {
		const prev = { name: 'a', url: 'u', summary: 's' };
		const next = { name: 'a', url: 'CHANGED', summary: 's' };

		expect(diffPayload(next, prev)).toEqual({ url: 'CHANGED' });
	});

	it('returns nothing when a record is untouched', () => {
		const same = { name: 'a', stars: null };

		expect(diffPayload({ ...same }, { ...same })).toEqual({});
	});

	it('treats a coerced no-op as unchanged', () => {
		// "" -> null in the caller's body mapping, on both sides of the diff.
		expect(diffPayload({ stars: null }, { stars: null })).toEqual({});
	});

	it('emits a cleared field so the server can null it', () => {
		expect(diffPayload({ url: null }, { url: 'u' })).toEqual({ url: null });
	});

	it('ignores keys missing from the incoming body', () => {
		// Both sides come from the same mapping, so this shouldn't arise — but a
		// guessed deletion would be worse than leaving the field alone.
		expect(diffPayload({ a: 1 } as Record<string, unknown>, { a: 1, b: 2 })).toEqual({});
	});
});
