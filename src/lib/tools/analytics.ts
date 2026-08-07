import { browser } from '$app/environment';
import { getWindowVariable } from './window';

/**
 * The Umami script is loaded with `defer` in +layout.svelte, so an early
 * track()/identify() call from a component's onMount may fire before
 * window.umami exists. Queue calls until the script is ready, then drain.
 */

type UmamiApi = {
	track?: (name: string) => void;
	identify?: (data: Record<string, unknown>) => void;
};

const pendingCalls: Array<(umami: UmamiApi) => void> = [];
let drained = false;

function tryDrain(): boolean {
	const umami = getWindowVariable('umami') as UmamiApi | null;
	if (!umami || typeof umami.track !== 'function') return false;
	for (const fn of pendingCalls) {
		try {
			fn(umami);
		} catch {
			// Swallow — analytics failures must never affect the app.
		}
	}
	pendingCalls.length = 0;
	drained = true;
	return true;
}

function enqueue(fn: (umami: UmamiApi) => void): void {
	if (!browser) return;
	if (drained) {
		const umami = getWindowVariable('umami') as UmamiApi | null;
		if (umami) {
			try {
				fn(umami);
			} catch {
				// Swallow.
			}
			return;
		}
		drained = false;
	}
	pendingCalls.push(fn);
	if (tryDrain()) return;
	// Poll briefly: the deferred Umami script usually finishes within a few
	// hundred ms of page mount. Cap at ~5s so a missing/blocked script
	// doesn't leak intervals forever.
	let attempts = 0;
	const interval = setInterval(() => {
		attempts += 1;
		if (tryDrain() || attempts > 25) {
			clearInterval(interval);
		}
	}, 200);
}

export function track(name: string): void {
	enqueue((umami) => {
		if (typeof umami.track === 'function') umami.track(name);
	});
}

type IdentifyData = {
	id: string;
	[key: string]: string | number | boolean | undefined;
};

export function identify(data: IdentifyData): void {
	enqueue((umami) => {
		if (typeof umami.identify === 'function') umami.identify(data);
	});
}
