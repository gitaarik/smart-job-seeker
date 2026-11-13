/**
 * Whether an address is at a throwaway mail service.
 *
 * Open registration hands every new account a free credit allowance, and a
 * disposable inbox is how one person collects it many times: the captcha stops
 * scripts, email verification stops addresses nobody reads, and neither stops
 * a person with a fresh mailinator address per signup. So signups and email
 * changes to these domains are refused (`signup-gate.ts`). Existing accounts
 * are left alone.
 *
 * The list is the community-maintained disposable-email-domains blocklist,
 * packaged without dependencies and updated monthly, so a Dependabot bump is
 * how it stays current. A parent domain on the list covers its subdomains,
 * since many of these services hand out `anything.example.com`.
 */
import { disposableEmailBlocklistSet } from 'disposable-email-domains-js';

let blocklist: Set<string> | null = null;

export function isDisposableEmail(email: string): boolean {
	const at = email.lastIndexOf('@');
	if (at < 0) return false;
	const domain = email
		.slice(at + 1)
		.trim()
		.toLowerCase()
		.replace(/\.$/, '');
	if (!domain) return false;

	blocklist ??= disposableEmailBlocklistSet();
	const labels = domain.split('.');
	// Stop before the bare TLD: `com` is not on the list, and checking it
	// would only cost a lookup.
	for (let i = 0; i < labels.length - 1; i++) {
		if (blocklist.has(labels.slice(i).join('.'))) return true;
	}
	return false;
}
