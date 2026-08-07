/**
 * Lightweight secret scanning + redaction for extracted document text.
 *
 * People WILL drag `.env` files and key-laden configs into uploads. We must not
 * persist their credentials verbatim (they'd end up in the AI corpus and in
 * `collected_data`). This is a best-effort gitleaks-style pass — it redacts the
 * obvious high-confidence tokens and `KEY=secret` assignments, not a guarantee.
 */

/** High-confidence token shapes → the whole match is replaced. */
const TOKEN_PATTERNS: { name: string; re: RegExp }[] = [
	{
		name: 'private-key',
		re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g
	},
	{ name: 'aws-access-key', re: /\bAKIA[0-9A-Z]{16}\b/g },
	{ name: 'github-token', re: /\bgh[porsu]_[0-9A-Za-z]{36,}\b/g },
	{ name: 'github-pat', re: /\bgithub_pat_[0-9A-Za-z_]{22,}\b/g },
	{ name: 'slack-token', re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/g },
	{ name: 'google-api-key', re: /\bAIza[0-9A-Za-z\-_]{35}\b/g },
	{ name: 'stripe-key', re: /\bsk_(?:live|test)_[0-9A-Za-z]{16,}\b/g },
	{
		name: 'jwt',
		re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g
	}
];

/**
 * `SECRET = "value"` style assignments (env files, config). We keep the key
 * name (useful context) and redact only the value.
 */
const ASSIGNMENT_RE =
	/\b([A-Za-z0-9_]*(?:secret|token|api[_-]?key|password|passwd|pwd|private[_-]?key|access[_-]?key|auth)[A-Za-z0-9_]*)(\s*[:=]\s*)(['"]?)([^\s'"]{8,})\3/gi;

export interface SecretScanResult {
	text: string;
	/** Number of secrets redacted. */
	count: number;
}

/**
 * Redact detected secrets from `text`. Returns the redacted text and a count.
 * Idempotent-ish: re-running over redacted text finds nothing new.
 */
export function redactSecrets(text: string): SecretScanResult {
	let count = 0;
	let out = text;

	for (const { name, re } of TOKEN_PATTERNS) {
		out = out.replace(re, () => {
			count++;
			return `[REDACTED:${name}]`;
		});
	}

	out = out.replace(ASSIGNMENT_RE, (_m, key, op, quote) => {
		count++;
		return `${key}${op}${quote}[REDACTED]${quote}`;
	});

	return { text: out, count };
}
