/**
 * Where an operator alert goes: email to SJS_ADMIN_EMAIL, and Telegram when a
 * bot is configured. Either may be missing; with neither, the alert is only
 * logged, which is still where a self-hoster tailing the worker will see it.
 *
 * Telegram is there because email is the wrong channel for "the site is on
 * fire": it is read in batches, and the mail itself goes out through the same
 * stack that may be what broke. Set SJS_ALERT_TELEGRAM_BOT_TOKEN and
 * SJS_ALERT_TELEGRAM_CHAT_ID (the chat the bot posts into).
 *
 * Each channel is tried on its own, and a failure in one is logged and does
 * not stop the other.
 */

import { getEnv } from '#lib/tools/get-env.ts';
import { sendEmail } from '#lib/server/email/index.ts';

export interface OpsNotice {
	/** One line: the email subject, and the first line of the Telegram text. */
	subject: string;
	/** Plain text detail. */
	body: string;
}

const TELEGRAM_TIMEOUT_MS = 10_000;

function escapeHtml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function sendTelegram(token: string, chatId: string, text: string): Promise<void> {
	const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
		signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS)
	});
	if (!res.ok) throw new Error(`Telegram answered ${res.status}`);
}

/** The environment's name in the subject, so preview and prod alerts differ. */
function envLabel(): string {
	return getEnv('SJS_APP_URL_HOST', '').replace(/^https?:\/\//, '') || 'sjs';
}

export async function sendOpsNotice(notice: OpsNotice): Promise<void> {
	const subject = `[${envLabel()}] ${notice.subject}`;
	console.warn(`🚨 [Ops] ${subject}\n${notice.body}`);

	const adminEmail = getEnv('SJS_ADMIN_EMAIL', '');
	const token = getEnv('SJS_ALERT_TELEGRAM_BOT_TOKEN', '');
	const chatId = getEnv('SJS_ALERT_TELEGRAM_CHAT_ID', '');

	const sends: Promise<void>[] = [];
	if (adminEmail) {
		sends.push(
			sendEmail({
				to: adminEmail,
				subject,
				html: `<pre style="font-family:monospace;white-space:pre-wrap">${escapeHtml(notice.body)}</pre>`,
				type: 'admin_notification',
				metadata: { kind: 'ops_alert' }
			}).then(() => undefined)
		);
	}
	if (token && chatId) {
		sends.push(sendTelegram(token, chatId, `${subject}\n\n${notice.body}`));
	}

	const results = await Promise.allSettled(sends);
	for (const r of results) {
		if (r.status === 'rejected') {
			const message = r.reason instanceof Error ? r.reason.message : String(r.reason);
			console.error(`❌ [Ops] Alert channel failed: ${message}`);
		}
	}
}
