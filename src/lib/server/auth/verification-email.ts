/**
 * The mail behind better-auth's `emailVerification.sendVerificationEmail`, which
 * is really two mails.
 *
 * better-auth sends both through that one hook: verifying the address a new
 * account signed up with, and verifying the address a signed-in user is
 * changing to. For a change it passes the user with `email` already set to the
 * NEW address, while the stored row still holds the old one, and that
 * difference is the only thing that tells the two apart.
 *
 * The change used to have a mail of its own, set as
 * `user.changeEmail.sendChangeEmailVerification`. better-auth dropped that
 * option (1.7.5 has no trace of it), so from then on a change got the generic
 * "Verify your email address" mail, which never says what is being changed.
 */
import type { EmailType } from '$lib/server/email';

export interface VerificationMail {
	to: string;
	subject: string;
	html: string;
	type: EmailType;
	userId: string;
}

/**
 * @param user        What better-auth passes: for a change, `email` is the new address.
 * @param url         The verification link.
 * @param storedEmail The address on the user's row, or null when there is no row.
 */
export function verificationMail(
	user: { id: string; email: string },
	url: string,
	storedEmail: string | null
): VerificationMail {
	const isChange = storedEmail !== null && storedEmail.toLowerCase() !== user.email.toLowerCase();

	if (isChange) {
		return {
			to: user.email,
			subject: 'Verify your new email address',
			html: `
          <h2>Verify your new email</h2>
          <p>Click the link below to confirm changing your email to <strong>${escapeHtml(user.email)}</strong>:</p>
          <p><a href="${escapeHtml(url)}">Verify Email</a></p>
          <p>If you didn't request this, you can safely ignore this email.</p>
          <p>This link will expire in 1 hour.</p>
        `,
			type: 'email_change',
			userId: user.id
		};
	}

	return {
		to: user.email,
		subject: 'Verify your email address',
		html: `
          <h2>Verify your email</h2>
          <p>Click the link below to verify your email address:</p>
          <p><a href="${escapeHtml(url)}">Verify Email</a></p>
          <p>If you didn't request this, you can safely ignore this email.</p>
        `,
		type: 'verification',
		userId: user.id
	};
}

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}
