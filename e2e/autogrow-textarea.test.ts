/**
 * Browser E2E — AutoGrowTextarea sizes itself to its content.
 *
 * The component measures `scrollHeight` and writes `height`, and it caps that
 * at `maxRows` by reading computed line-height, padding and border. None of
 * that exists under jsdom: `scrollHeight` is 0 and `getComputedStyle` returns
 * `normal` for line-height, so a unit test can only prove the wiring, never
 * the sizing. The same goes for the ResizeObserver added when the component
 * was rolled out to the translatable profile fields — text re-wraps when the
 * field gets narrower, and without an observer the height stays stale until
 * the next keystroke, which with `overflow-y: hidden` silently clips content.
 *
 * Non-mutating: the profile fields are measured, never typed into, and the
 * assistant input is a draft that is never sent.
 *
 * Prerequisites: dev stack running, test user seeded (see browser.test.ts).
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { loginViaUI, useBrowser } from './browser';

const CHAT = 'textarea[placeholder="Ask your assistant…"]';
/** The base-language side of TranslatableField's multiline fields. */
const FIELD = 'textarea[lang="en"]';

describe('AutoGrowTextarea', () => {
	const b = useBrowser();

	beforeAll(async () => {
		await loginViaUI(b.page);
		await b.page.goto('/profile/edit');
		await b.page.waitForLoadState('networkidle');
	});

	/** The most-filled field on the page — the one with something to wrap. */
	async function longestField() {
		const i = await b.page.$$eval(FIELD, (els) => {
			const len = (e: Element) => (e as HTMLTextAreaElement).value.length;
			return els.reduce((best, e, idx) => (len(e) > len(els[best]) ? idx : best), 0);
		});
		return b.page.locator(FIELD).nth(i);
	}

	it('fits a server-rendered value without anyone typing', async () => {
		const box = await (
			await longestField()
		).evaluate((el: HTMLTextAreaElement) => ({
			len: el.value.length,
			height: el.clientHeight,
			scroll: el.scrollHeight,
			resize: getComputedStyle(el).resize
		}));
		expect(box.len).toBeGreaterThan(0);
		expect(box.resize).toBe('none');
		// Sub-pixel line-heights round the two apart by less than a pixel.
		expect(box.height).toBeGreaterThanOrEqual(box.scroll - 1);
	});

	it('re-measures when it gets narrower, with no input event', async () => {
		// Driven by the element's own width rather than the viewport's: the
		// form column is wide enough that a narrower window still wraps this
		// value inside its minimum rows, and the point here is the observer,
		// not the page's breakpoints.
		const field = await longestField();
		const before = await field.evaluate((el) => el.clientHeight);

		await field.evaluate((el) => ((el as HTMLElement).style.width = '160px'));
		await expect.poll(() => field.evaluate((el) => el.clientHeight)).toBeGreaterThan(before);

		await field.evaluate((el) => ((el as HTMLElement).style.width = ''));
		await expect.poll(() => field.evaluate((el) => el.clientHeight)).toBe(before);
	});

	it('grows with typed content and caps at maxRows', async () => {
		await b.page.getByRole('button', { name: 'Open assistant' }).click();
		await b.page.waitForSelector(CHAT);
		const height = () => b.page.$eval(CHAT, (el: HTMLTextAreaElement) => el.clientHeight);
		const overflow = () => b.page.$eval(CHAT, (el: HTMLTextAreaElement) => el.style.overflowY);

		await b.page.fill(CHAT, 'one line');
		const oneLine = await height();

		await b.page.fill(CHAT, 'a\nb\nc');
		const threeLines = await height();
		expect(threeLines).toBeGreaterThan(oneLine);
		expect(await overflow()).toBe('hidden');

		// AgentChat passes maxRows={5}, so 20 lines have to scroll, not grow.
		await b.page.fill(CHAT, Array.from({ length: 20 }, (_, i) => `line ${i}`).join('\n'));
		expect(await height()).toBeLessThan(threeLines * 3);
		expect(await overflow()).toBe('auto');
	});

	it('does not trip the ResizeObserver loop guard while resizing', async () => {
		// resize() writes height from inside the observer's own callback, so a
		// missing width guard would report "loop completed with undelivered
		// notifications" as a page error.
		const errors: string[] = [];
		b.page.on('pageerror', (e) => errors.push(String(e)));
		for (const width of [1280, 900, 640, 900, 1280]) {
			await b.page.setViewportSize({ width, height: 720 });
			await b.page.waitForTimeout(150);
		}
		expect(errors.filter((e) => /ResizeObserver/i.test(e))).toEqual([]);
	});
});
