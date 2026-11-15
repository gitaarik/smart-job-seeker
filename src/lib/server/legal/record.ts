/**
 * Recording that someone agreed to a legal text. Which text and version is
 * current is `texts.ts`; this is only the write.
 *
 * A self-service signup records its terms in the user-create hook
 * (auth/better-auth.ts), because better-auth creates the row there. The
 * invite pages, the other way an account starts from a form, call
 * `recordTermsAcceptance` once the account exists.
 */

import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { legal_acceptances, users } from '$lib/server/db/schema';
import { termsVersion } from './texts';

/** The `legal_acceptances.document` values. */
export type LegalDocument = 'terms' | 'withdrawal_waiver';

/** Append one acceptance to the log. */
export async function recordLegalAcceptance(
	userId: string,
	document: LegalDocument,
	version: string,
	detail?: Record<string, unknown>
): Promise<void> {
	await db.insert(legal_acceptances).values({
		user_id: userId,
		document,
		version,
		detail: detail ?? null
	});
}

/** The current terms, on the account and in the log. A no-op without terms. */
export async function recordTermsAcceptance(userId: string): Promise<void> {
	const version = termsVersion();
	if (!version) return;
	const now = new Date();
	await db
		.update(users)
		.set({ terms_version: version, terms_accepted_at: now })
		.where(eq(users.id, userId));
	await db.insert(legal_acceptances).values({
		user_id: userId,
		document: 'terms',
		version,
		accepted_at: now
	});
}

/**
 * Whether an invite form's terms box was ticked for the current version
 * (`TermsCheckbox` posts the version as its value). True when this instance
 * has no terms to accept.
 */
export function acceptedTermsField(formData: FormData): boolean {
	const version = termsVersion();
	return version === null || formData.get('accept_terms') === version;
}
