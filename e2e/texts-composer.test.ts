/**
 * Browser E2E for the application-texts composer.
 *
 * The composer is deliberately the same widget before an AI thread exists and
 * after it — only the button row differs — so what is worth testing is that it
 * switches on the right signal and that writing your own version stays
 * reachable in both states.
 *
 * Questions run the composer with `autoMode` on, so the pre-thread state is
 * one unified "Send to AI" (the model decides draft vs. advice) alongside
 * "Write a draft" / "Get advice" starter chips. Those chips are the pre-thread
 * signal: once a thread exists they disappear and only "Send to AI" remains.
 * The older split "AI advice" / "AI generate" pair is the `autoMode=false`
 * path, which nothing in applications uses any more.
 *
 * Nothing here triggers a real generation: clicking a starter chip or Send
 * would spend credits and real tokens on every run, and the model's behaviour
 * is covered by `npm run llm:smoke` instead. This asserts the UI states around
 * those buttons, which is what a browser can check cheaply.
 *
 * Prerequisites: dev stack up, test user seeded (see browser.test.ts).
 *
 * Run: npm run test:e2e
 */

import { describe, expect, it } from 'vitest';
import { execSync } from 'child_process';
import { unlinkSync, writeFileSync } from 'fs';
import { loginViaUI, useBrowser } from './browser';

/** The test user's seeded application, which already has one of each text. */
const APP_ID = 16;
const PROBE = 'E2E composer probe — safe to delete';
const EDIT_PROBE = 'E2E inline-edit probe — safe to delete';
const DELETE_PROBE = 'E2E delete probe — safe to delete';

/**
 * Run SQL against the dev database.
 *
 * Used by the delete suite to plant one advice turn. That state — a version row
 * with feedback but no content — is only reachable through a real generation,
 * and this file deliberately spends no tokens (see the header), so the row is
 * seeded instead. Everything the test then asserts still goes through the UI
 * and the real form actions. Piped from a file because the statements carry
 * quotes of their own.
 */
function sql(query: string): string {
	const file = `/tmp/sjs-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`;
	writeFileSync(file, query);
	try {
		return execSync(
			`npx dotenvx run --quiet -- sh -c 'docker compose exec -T database ` +
				`psql -U \${SJS_DB_USER:-postgres} -d \${SJS_DB_DATABASE:-smartjobseeker} -t -A' < ${file}`,
			{
				cwd: process.env.SJS_CLOUD_DIR || `${process.cwd()}/..`,
				encoding: 'utf-8',
				shell: '/bin/bash'
			}
		).trim();
	} finally {
		unlinkSync(file);
	}
}

describe('texts composer — no AI thread yet', () => {
	const b = useBrowser();
	// Set by the first test, used by the rest and removed by the last.
	let questionUrl: string | null = null;

	it('creates a question and opens its editor', async () => {
		await loginViaUI(b.page);
		await b.page.goto(`/applications/${APP_ID}/texts`);
		await b.page.waitForLoadState('networkidle');

		// The add menu closes on click-outside; its trigger has to sit inside
		// [data-add-menu] or the same click that opens it closes it again.
		await b.page.getByRole('button', { name: /^Add$/ }).first().click();
		await b.page.getByRole('button', { name: /Application Question/i }).click();

		await b.page.locator('#new-question').fill(PROBE);
		await b.page.getByRole('button', { name: /Add & open editor/i }).click();

		await b.page.waitForURL('**/texts/questions/**', { timeout: 10000 });
		questionUrl = b.page.url();
		expect(questionUrl).toContain('/texts/questions/');
	});

	it('offers the starter chips alongside the unified send', async () => {
		expect(questionUrl).toBeTruthy();
		await b.page.goto(questionUrl!);
		await b.page.waitForLoadState('networkidle');

		// Pre-thread only: these are what disappear once a conversation exists.
		expect(await b.page.getByRole('button', { name: 'Write a draft' }).isVisible()).toBe(true);
		expect(await b.page.getByRole('button', { name: 'Get advice' }).isVisible()).toBe(true);
		// In autoMode the same Send drives the first turn as well as followups.
		expect(await b.page.getByRole('button', { name: 'Send to AI' }).isVisible()).toBe(true);
	});

	it('invites an optional brief for that first turn', async () => {
		const composer = b.page.locator('textarea').last();
		expect(await composer.isVisible()).toBe(true);

		const placeholder = await composer.getAttribute('placeholder');
		// Optional is the point: leaving it blank must stay an obvious path.
		expect(placeholder).toMatch(/leave blank/i);
		expect(placeholder).toMatch(/ask for a draft|ask a question/i);

		// A brief is accepted, and typing one must not send anything on its own —
		// the turn is still unstarted, which the starter chips prove.
		await composer.fill('Keep it under 100 words.');
		expect(await composer.inputValue()).toBe('Keep it under 100 words.');
		expect(await b.page.getByRole('button', { name: 'Write a draft' }).isVisible()).toBe(true);
	});

	it('grows the brief box with the text and caps it', async () => {
		// The composer is an AutoGrowTextarea, like the assistant input: a long
		// brief must not be typed into a three-line slot. jsdom can't measure
		// this (scrollHeight is 0 there), so a browser is the only place it can
		// be checked — see autogrow-textarea.test.ts for the component's own
		// coverage. Nothing here sends: the box is filled and then cleared.
		const composer = b.page.locator('textarea').last();
		const height = () => composer.evaluate((el: HTMLTextAreaElement) => el.clientHeight);
		const overflow = () => composer.evaluate((el: HTMLTextAreaElement) => el.style.overflowY);

		await composer.fill('one line');
		const minimum = await height();
		expect(await overflow()).toBe('hidden');

		await composer.fill(Array.from({ length: 6 }, (_, i) => `line ${i}`).join('\n'));
		expect(await height()).toBeGreaterThan(minimum);
		expect(await overflow()).toBe('hidden');

		// maxRows={12}: past that it scrolls rather than eating the page.
		await composer.fill(Array.from({ length: 40 }, (_, i) => `line ${i}`).join('\n'));
		const capped = await height();
		expect(await overflow()).toBe('auto');

		// And it shrinks back, rather than keeping the height it grew to.
		await composer.fill('');
		expect(await height()).toBeLessThan(capped);
		expect(await height()).toBe(minimum);
	});

	it('keeps writing your own version one click away', async () => {
		const own = b.page.getByRole('button', {
			name: /Write \/ paste my own version/i
		});
		expect(await own.isVisible()).toBe(true);

		await own.click();
		expect(await b.page.getByText('Your own version').isVisible()).toBe(true);
		expect(await b.page.getByRole('button', { name: /Save my version/i }).isVisible()).toBe(true);
		expect(await b.page.getByRole('button', { name: /Save & AI review/i }).isVisible()).toBe(true);

		await b.page
			.getByRole('button', { name: /^Cancel$/ })
			.first()
			.click();
		expect(await b.page.getByText('Your own version').count()).toBe(0);
	});

	it('removes the probe question', async () => {
		await b.page.goto(`/applications/${APP_ID}/texts`);
		await b.page.waitForLoadState('networkidle');

		// Scope to the probe's own card so a second question is never hit.
		await b.page
			.locator('button', { hasText: PROBE })
			.getByLabel('Delete question')
			.first()
			.click();
		await b.page.getByRole('button', { name: /^Confirm$/ }).click();
		await b.page.waitForLoadState('networkidle');

		expect(await b.page.getByText(PROBE).count()).toBe(0);
	});
});

describe('texts composer — thread in progress', () => {
	const b = useBrowser();

	it('switches to a followup message once a thread exists', async () => {
		await loginViaUI(b.page);
		// The seeded cover letter already has an ai_chat_id, so it renders the
		// other branch of the same composer.
		await b.page.goto(`/applications/${APP_ID}/texts`);
		await b.page.waitForLoadState('networkidle');
		// Target a letter specifically rather than the first Edit link on the
		// page. Letters live at /texts/<id> and questions at /texts/questions/<id>,
		// and only the seeded letter is guaranteed to carry an ai_chat_id — one
		// stray thread-less question sorting first is enough to open the
		// pre-thread composer and fail this for the wrong reason.
		await b.page
			.locator('a[aria-label="Edit"][href*="/texts/"]:not([href*="/questions/"])')
			.first()
			.click();
		await b.page.waitForURL('**/texts/**', { timeout: 10000 });
		await b.page.waitForLoadState('networkidle');

		expect(await b.page.getByRole('button', { name: 'Send to AI' }).isVisible()).toBe(true);
		// The starter chips belong to the empty state only. Asserting on these
		// rather than the retired "AI advice" label matters: a name nothing
		// renders any more passes this check no matter what the UI does.
		expect(await b.page.getByRole('button', { name: 'Write a draft' }).count()).toBe(0);
		expect(await b.page.getByRole('button', { name: 'Get advice' }).count()).toBe(0);

		const composer = b.page.locator('textarea').last();
		const placeholder = await composer.getAttribute('placeholder');
		expect(placeholder).toMatch(/message the ai/i);

		// Same escape hatch, same wording, mid-conversation.
		expect(
			await b.page
				.getByRole('button', {
					name: /Write \/ paste my own version/i
				})
				.isVisible()
		).toBe(true);
	});
});

describe('texts composer — editing a version inline', () => {
	const b = useBrowser();

	// Deliberately disjoint, so the second version is far past isSmallDiff's
	// threshold: the diff that shows afterwards can then only have been opened
	// on purpose, never by the auto-show.
	const V1 = 'Version one, typed by hand so this probe never spends a token.';
	const V2 = 'Completely different wording; nothing from that first draft survives.';

	it('writes a first version by hand', async () => {
		await loginViaUI(b.page);
		await b.page.goto(`/applications/${APP_ID}/texts`);
		await b.page.waitForLoadState('networkidle');

		await b.page.getByRole('button', { name: /^Add$/ }).first().click();
		await b.page.getByRole('button', { name: /Application Question/i }).click();
		await b.page.locator('#new-question').fill(EDIT_PROBE);
		await b.page.getByRole('button', { name: /Add & open editor/i }).click();

		await b.page.waitForURL('**/texts/questions/**', { timeout: 10000 });

		// Through the composer rather than the AI, so this costs nothing to run.
		await b.page.getByRole('button', { name: /Write \/ paste my own version/i }).click();
		await b.page.locator('[contenteditable="true"]').last().fill(V1);
		await b.page.getByRole('button', { name: /Save my version/i }).click();
		await b.page.waitForLoadState('networkidle');

		expect(
			await b.page
				.getByText(/Version 1/)
				.first()
				.isVisible()
		).toBe(true);
	});

	it('says which version the edit will be saved as', async () => {
		await b.page
			.getByRole('button', { name: /^Edit$/ })
			.first()
			.click();

		// Unchanged content records no version, so nothing promises one yet.
		expect(await b.page.getByRole('button', { name: /^Save$/ }).isVisible()).toBe(true);
		expect(await b.page.getByRole('button', { name: /Save as version/ }).count()).toBe(0);

		await b.page.locator('[contenteditable="true"]').first().fill(V2);

		// The whole point: an inline edit appends, and says so before you commit it.
		expect(await b.page.getByRole('button', { name: /Save as version 2/ }).isVisible()).toBe(true);
		expect(await b.page.getByText(/Saves as version 2/).isVisible()).toBe(true);
		expect(await b.page.getByRole('button', { name: /^Save$/ }).count()).toBe(0);

		// The one-step review reaches the inline editor, not just the composer.
		expect(await b.page.getByRole('button', { name: /Save & AI review/i }).isVisible()).toBe(true);
	});

	it('keeps the edited version and opens the diff on the new one', async () => {
		await b.page.getByRole('button', { name: /Save as version 2/ }).click();
		await b.page.waitForLoadState('networkidle');

		// Version 1 survived the edit; it is behind the collapse bar, not gone.
		expect(await b.page.getByRole('button', { name: /Show full conversation/ }).isVisible()).toBe(
			true
		);

		// "Hide changes" means the diff is already open. This rewrite is far too
		// large for the auto-show, so only the post-save reveal can have done it.
		expect(
			await b.page
				.getByRole('button', { name: /Hide changes/i })
				.first()
				.isVisible()
		).toBe(true);
	});

	it('removes the probe question', async () => {
		await b.page.goto(`/applications/${APP_ID}/texts`);
		await b.page.waitForLoadState('networkidle');

		await b.page
			.locator('button', { hasText: EDIT_PROBE })
			.getByLabel('Delete question')
			.first()
			.click();
		await b.page.getByRole('button', { name: /^Confirm$/ }).click();
		await b.page.waitForLoadState('networkidle');

		expect(await b.page.getByText(EDIT_PROBE).count()).toBe(0);
	});
});

/**
 * Deleting is how you back out of a turn, so it has to reach every part of one.
 * It used to sit on the latest *version* only, which left an advice turn — the
 * common "ask a question first" opener — with no affordance at all: no version,
 * so no box, so no delete, and a thread pointer that hid the starter chips
 * behind a composer that could only carry the conversation forward.
 */
describe('texts composer — deleting a turn', () => {
	const b = useBrowser();

	const V1 = 'Delete probe version one, typed by hand so this spends no token.';
	const V2 = 'Delete probe version two, worded nothing like the first one was.';
	let questionId = 0;

	it('writes two versions by hand', async () => {
		await loginViaUI(b.page);
		await b.page.goto(`/applications/${APP_ID}/texts`);
		await b.page.waitForLoadState('networkidle');

		await b.page.getByRole('button', { name: /^Add$/ }).first().click();
		await b.page.getByRole('button', { name: /Application Question/i }).click();
		await b.page.locator('#new-question').fill(DELETE_PROBE);
		await b.page.getByRole('button', { name: /Add & open editor/i }).click();
		await b.page.waitForURL('**/texts/questions/**', { timeout: 10000 });
		questionId = Number(b.page.url().split('/').pop());
		expect(questionId).toBeGreaterThan(0);

		for (const version of [V1, V2]) {
			await b.page.getByRole('button', { name: /Write \/ paste my own version/i }).click();
			await b.page.locator('[contenteditable="true"]').last().fill(version);
			await b.page.getByRole('button', { name: /Save my version/i }).click();
			await b.page.waitForLoadState('networkidle');
			await b.page.waitForTimeout(400);
		}

		expect(sql(`SELECT count(*) FROM question_versions WHERE question = ${questionId}`)).toBe('2');
		expect(sql(`SELECT answer FROM application_questions WHERE id = ${questionId}`)).toBe(V2);
	});

	it('asks before dropping a version, and rewinds the answer with it', async () => {
		await b.page.reload();
		await b.page.waitForLoadState('networkidle');

		await b.page.getByRole('button', { name: 'Delete version' }).click();
		// A version is going, so it says so rather than acting on the click.
		expect(await b.page.getByText(/removes 1 version/i).isVisible()).toBe(true);
		await b.page.getByRole('button', { name: /^Delete$/ }).click();
		await b.page.waitForLoadState('networkidle');
		await b.page.waitForTimeout(600);

		expect(sql(`SELECT count(*) FROM question_versions WHERE question = ${questionId}`)).toBe('1');
		// The committed answer must not keep showing text the trail no longer has.
		expect(sql(`SELECT answer FROM application_questions WHERE id = ${questionId}`)).toBe(V1);
	});

	it('offers a way out of an advice turn that produced no version', async () => {
		sql(
			`INSERT INTO question_versions (question, content, source, ai_feedback, user_request) ` +
				`VALUES (${questionId}, NULL, 'ai_advice', 'Lead with the migration.', 'What should I emphasize?')`
		);
		sql(`UPDATE application_questions SET ai_chat_id = 1 WHERE id = ${questionId}`);
		await b.page.reload();
		await b.page.waitForLoadState('networkidle');

		// A thread exists, so the composer can only carry it forward…
		expect(await b.page.getByRole('button', { name: 'Get advice' }).count()).toBe(0);
		// …the review button follows the latest *version*, not the last entry, so
		// asking a question after a draft does not take it away…
		expect(await b.page.getByRole('button', { name: 'AI review' }).isVisible()).toBe(true);
		// …and both halves of the turn are what make backing out possible.
		expect(await b.page.getByRole('button', { name: 'Delete response' }).isVisible()).toBe(true);
		await b.page.getByRole('button', { name: 'Delete turn' }).click();
		await b.page.waitForLoadState('networkidle');
		await b.page.waitForTimeout(600);

		// Nothing followed it and it held no version, so it went on one click.
		expect(sql(`SELECT count(*) FROM question_versions WHERE question = ${questionId}`)).toBe('1');
		// Thread pointer cleared, so the editor is offering to start over.
		expect(sql(`SELECT ai_chat_id FROM application_questions WHERE id = ${questionId}`)).toBe('');
		expect(await b.page.getByRole('button', { name: 'Get advice' }).isVisible()).toBe(true);
	});

	it('removes the probe question', async () => {
		await b.page.goto(`/applications/${APP_ID}/texts`);
		await b.page.waitForLoadState('networkidle');

		await b.page
			.locator('button', { hasText: DELETE_PROBE })
			.getByLabel('Delete question')
			.first()
			.click();
		await b.page.getByRole('button', { name: /^Confirm$/ }).click();
		await b.page.waitForLoadState('networkidle');

		expect(await b.page.getByText(DELETE_PROBE).count()).toBe(0);
	});
});
