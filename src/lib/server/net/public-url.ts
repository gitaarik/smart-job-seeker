/**
 * Validation for URLs that a browser will later be pointed at on our behalf.
 *
 * Import tasks carry two user-supplied navigation targets: `search_tasks.
 * search_url` and the `platform_url` that creates a `job_platforms` row. The
 * scraper navigates a real browser to whichever one wins, and the user can
 * watch the result (noVNC live view, screenshots, scraper logs, the extracted
 * listings). When the task's `browser_provider` is "local" that browser is our
 * own Chrome container, which sits on the compose network beside `database`,
 * `redis`, `app` and `worker` and carries an `extra_hosts` mapping for
 * `host.docker.internal`. Without a check, "paste a search URL" reads internal
 * services and cloud metadata endpoints back to the person who pasted it.
 *
 * That hole predates the custom-site UI — the create action always parsed
 * `platform_url` and `search_url` out of the form body, so any authenticated
 * user could craft the POST — but exposing a text box for it, and making the
 * task's URL authoritative over the platform's search page, is what turned a
 * crafted request into a typed one.
 *
 * Scope, stated plainly: this is a string check on the host, run when the URL
 * is saved. It stops the direct cases. It cannot stop DNS rebinding, a public
 * hostname whose A record points at 10.x, or a redirect from a public page to
 * a private one, because the navigation happens later and in a different
 * process. Egress filtering on the browser container is the control that
 * actually closes those; this is the cheap layer in front of it.
 */

/** Hosts that are ours regardless of how they resolve. */
const BLOCKED_HOST_SUFFIXES = ['.localhost', '.internal', '.local', '.docker'];
const BLOCKED_HOSTS = new Set(['localhost', 'host.docker.internal', 'metadata.google.internal']);

export interface PublicUrlOk {
	ok: true;
	url: URL;
}
export interface PublicUrlRejected {
	ok: false;
	/** User-facing reason, safe to show in a form error. */
	reason: string;
}
export type PublicUrlResult = PublicUrlOk | PublicUrlRejected;

/**
 * True when `host` is an IP literal inside a range that never belongs to a
 * public job board: loopback, RFC1918, link-local (which covers the cloud
 * metadata endpoint at 169.254.169.254), CGNAT, and their IPv6 equivalents.
 */
function isPrivateAddress(host: string): boolean {
	// IPv6 arrives from `URL` wrapped in brackets.
	const bare = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;

	const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(bare);
	if (v4) {
		const [a, b] = v4.slice(1).map(Number);
		if ([a, b].some((n) => n > 255)) return true; // malformed, refuse rather than guess
		if (a === 0 || a === 10 || a === 127) return true;
		if (a === 169 && b === 254) return true; // link-local + cloud metadata
		if (a === 172 && b >= 16 && b <= 31) return true;
		if (a === 192 && b === 168) return true;
		if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
		return false;
	}

	if (bare.includes(':')) {
		const v6 = bare.toLowerCase();
		if (v6 === '::1' || v6 === '::') return true;
		if (v6.startsWith('fe80')) return true; // link-local
		if (/^f[cd]/.test(v6)) return true; // unique-local fc00::/7
		// ::ffff:10.0.0.1 and friends — check the embedded v4.
		const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(v6);
		if (mapped) return isPrivateAddress(mapped[1]);
		return false;
	}

	return false;
}

/**
 * Accept only an absolute http(s) URL on a host that could plausibly be on the
 * public internet. Returns the parsed URL so callers can store a normalised
 * form rather than re-parsing.
 */
export function checkPublicHttpUrl(raw: string | null | undefined): PublicUrlResult {
	const trimmed = raw?.trim();
	if (!trimmed) return { ok: false, reason: 'Enter a URL.' };

	let url: URL;
	try {
		url = new URL(trimmed);
	} catch {
		return { ok: false, reason: 'Enter a full URL including https://' };
	}

	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		return { ok: false, reason: 'Only http:// and https:// addresses are supported.' };
	}

	const host = url.hostname.toLowerCase();
	if (!host) return { ok: false, reason: 'That URL has no host.' };

	if (BLOCKED_HOSTS.has(host) || BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))) {
		return { ok: false, reason: 'That address is not reachable from the job importer.' };
	}

	if (isPrivateAddress(host)) {
		return { ok: false, reason: 'That address is not reachable from the job importer.' };
	}

	// A bare label with no dot is a container or LAN name (`database`, `redis`,
	// `app`), never a site on the internet.
	if (!host.includes('.')) {
		return { ok: false, reason: 'That address is not reachable from the job importer.' };
	}

	return { ok: true, url };
}

/** Convenience for call sites that only need the boolean. */
export function isPublicHttpUrl(raw: string | null | undefined): boolean {
	return checkPublicHttpUrl(raw).ok;
}
