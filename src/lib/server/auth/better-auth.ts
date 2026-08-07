/**
 * Better Auth Configuration
 *
 * Sets up email/password authentication with Drizzle adapter.
 */

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { verifications } from '$lib/server/db/schema';
import { getEnv } from '$lib/tools/get-env';
import { sendEmail } from '$lib/server/email';

export const auth = betterAuth({
	database: drizzleAdapter(db, { provider: 'pg' }),
	secret: getEnv('SJS_AUTH_SECRET'),
	baseURL: getEnv('SJS_APP_URL_HOST', 'http://localhost:5173'),
	trustedOrigins: getEnv('SJS_TRUSTED_ORIGINS', '')
		.split(',')
		.map((o) => o.trim())
		.filter(Boolean),
	advanced: {
		useSecureCookies:
			getEnv('SJS_APP_URL_HOST', '').startsWith('https://') && !getEnv('SJS_TRUSTED_ORIGINS', ''),
		ipAddress: {
			/**
			 * Rate limiting buckets per client IP, resolved from X-Forwarded-For.
			 * With no trustedProxies set, better-auth accepts the header ONLY when
			 * it holds exactly one entry (getIPFromHeader: `if (forwardedIps.length
			 * !== 1) return null`) — and Caddy *appends* to whatever the client
			 * sent. So anyone who supplies their own X-Forwarded-For produces two
			 * entries, the IP resolves to null, and every request on the server
			 * collapses into one shared bucket: the limit stops being per-attacker
			 * and one client can exhaust it for everybody.
			 *
			 * With trustedProxies set, better-auth walks the header right-to-left,
			 * skipping trusted hops and returning the first address it does not
			 * trust — the one Caddy actually observed. Spoofed entries sit to the
			 * LEFT of that and are ignored.
			 *
			 * Defaults cover a Caddy on the same host proxying into Docker. Override
			 * per environment when the topology differs (e.g. a CDN in front).
			 */
			trustedProxies: getEnv('SJS_TRUSTED_PROXIES', '127.0.0.1/32,::1/128,172.16.0.0/12')
				.split(',')
				.map((c) => c.trim())
				.filter(Boolean)
		}
	},

	/**
	 * Rate limiting is enabled by better-auth only when NODE_ENV=production
	 * (create-context: `enabled: options.rateLimit?.enabled ?? isProduction`),
	 * which the production compose sets. The global default of 100 requests per
	 * 10s is fine for session/token traffic but far too loose for the endpoints
	 * that accept a password or send mail, so those get their own buckets.
	 *
	 * Storage is in-process memory, so counters reset on deploy and are not
	 * shared between app instances — acceptable while production runs a single
	 * app node, and a thing to revisit alongside the other in-memory state when
	 * it does not.
	 */
	rateLimit: {
		customRules: {
			'/sign-in/email': { window: 60, max: 10 },
			'/sign-up/email': { window: 60, max: 5 },
			'/forget-password': { window: 60, max: 3 },
			'/reset-password': { window: 60, max: 5 },
			'/change-password': { window: 60, max: 5 }
		}
	},

	user: {
		modelName: 'users',
		changeEmail: {
			enabled: true,
			sendChangeEmailVerification: async ({ user, newEmail, url }) => {
				await sendEmail({
					to: newEmail,
					subject: 'Verify your new email address',
					html: `
            <h2>Verify your new email</h2>
            <p>Click the link below to confirm changing your email to <strong>${newEmail}</strong>:</p>
            <p><a href="${url}">Verify Email</a></p>
            <p>If you didn't request this, you can safely ignore this email.</p>
            <p>This link will expire in 1 hour.</p>
          `,
					type: 'email_change',
					userId: user.id
				});
			}
		},
		additionalFields: {
			is_admin: {
				type: 'boolean',
				defaultValue: false
			},
			is_staff: {
				type: 'boolean',
				defaultValue: false
			},
			is_approved: {
				type: 'boolean',
				defaultValue: false
			},
			is_demo: {
				type: 'boolean',
				defaultValue: false
			}
		}
	},
	account: { modelName: 'accounts' },
	verification: { modelName: 'verifications' },

	emailVerification: {
		sendVerificationEmail: async ({ user, url }) => {
			await sendEmail({
				to: user.email,
				subject: 'Verify your email address',
				html: `
          <h2>Verify your email</h2>
          <p>Click the link below to verify your email address:</p>
          <p><a href="${url}">Verify Email</a></p>
          <p>If you didn't request this, you can safely ignore this email.</p>
        `,
				type: 'verification',
				userId: user.id
			});
		}
	},

	emailAndPassword: {
		enabled: true,
		minPasswordLength: 8,
		sendResetPassword: async ({ user, url }) => {
			await sendEmail({
				to: user.email,
				subject: 'Reset your password',
				html: `
          <h2>Reset your password</h2>
          <p>Click the link below to reset your password:</p>
          <p><a href="${url}">Reset Password</a></p>
          <p>If you didn't request this, you can safely ignore this email.</p>
          <p>This link will expire in 1 hour.</p>
        `,
				type: 'password_reset',
				userId: user.id
			});
		}
	},

	session: {
		modelName: 'sessions',
		expiresIn: 60 * 60 * 24 * 7, // 7 days
		updateAge: 60 * 60 * 24 // Update session age daily
	},

	databaseHooks: {
		user: {
			create: {
				after: async (user) => {
					// Demo users get a synthetic, non-routable address — no welcome or
					// admin-notification emails (see lib/server/demo).
					if (user.email.endsWith('@demo.smartjobseeker.local')) return;

					// Skip welcome/admin emails for invited users (they already got an invite email)
					const invite = await db.query.verifications.findFirst({
						where: eq(verifications.identifier, `invite:${user.email}`)
					});
					if (invite) return;

					const adminEmail = getEnv('SJS_ADMIN_EMAIL', '');
					const appName = 'Smart Job Seeker';

					// Notify the new user
					await sendEmail({
						to: user.email,
						subject: `Welcome to ${appName}`,
						html: `
              <h2>Thanks for joining ${appName}!</h2>
              <p>Your account has been created and is pending approval.</p>
              <p>You'll receive an email once your account has been activated.</p>
            `,
						type: 'welcome',
						userId: user.id
					}).catch((err) => console.error('[auth] Failed to send welcome email:', err));

					// Notify admin
					if (adminEmail) {
						await sendEmail({
							to: adminEmail,
							subject: `[${appName}] New signup: ${user.email}`,
							html: `
                <h2>New user signup</h2>
                <p><strong>Name:</strong> ${user.name || '(not provided)'}</p>
                <p><strong>Email:</strong> ${user.email}</p>
                <p>Log in to the admin panel to approve this user.</p>
              `,
							type: 'admin_notification'
						}).catch((err) => console.error('[auth] Failed to send admin notification:', err));
					}
				}
			}
		}
	}
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
