/**
 * The transform that lets a scraper and a language model write into the same
 * field and both render.
 *
 * The case behind it: `job_description` was rendered as plain text, so the
 * assistant's markdown showed up as literal asterisks on the job page. Switching
 * the page to markdown fixes that author and breaks the other one — a scraped
 * posting's lists are indented lines, and four spaces is markdown for "this is
 * code".
 */
import { describe, expect, it } from 'vitest';
import { normalizePostingMarkdown } from '../posting-markdown';
import { renderSafeMarkdown } from '../safe-markdown';

const render = (text: string) =>
	renderSafeMarkdown(normalizePostingMarkdown(text), { breaks: true });

describe('normalizePostingMarkdown', () => {
	it('turns a scraped indented list into a real one', () => {
		const scraped = 'Je:\n\n    vertaalt product specs\n    bouwt en verbetert APIs';

		expect(normalizePostingMarkdown(scraped)).toBe(
			'Je:\n\n- vertaalt product specs\n- bouwt en verbetert APIs'
		);
	});

	it('renders that as a list rather than a code block', () => {
		// The whole point. Without the transform marked emits <pre><code>, which
		// is a grey monospace slab where the posting had bullets.
		const html = render('Je:\n\n    vertaalt product specs\n    bouwt en verbetert APIs');

		expect(html).toContain('<li>');
		expect(html).not.toContain('<code>');
	});

	it('leaves an already-marked list item alone but for its indent', () => {
		expect(normalizePostingMarkdown('    - one\n    2. two')).toBe('- one\n2. two');
	});

	it('leaves ordinary paragraphs untouched', () => {
		const text = 'Wat ga je doen?\n\nAls Lead Software Engineer ben jij de schakel.';

		expect(normalizePostingMarkdown(text)).toBe(text);
	});

	it('keeps a fenced code block as code', () => {
		// Indentation inside a fence is content, so the whole text is left alone.
		const text = 'Example:\n\n```\n    if (x) return;\n```';

		expect(normalizePostingMarkdown(text)).toBe(text);
	});

	it('keeps the assistant’s markdown working', () => {
		const written = '**De missie**\n\n*   Je definieert de roadmap.\n*   Je bouwt API’s.';

		const html = render(written);
		expect(html).toContain('<strong>De missie</strong>');
		expect(html).toContain('<li>');
	});

	it('keeps a bare newline as a line break', () => {
		// `breaks` is what makes this a safe replacement for whitespace-pre-wrap:
		// a scraped posting uses single newlines and markdown would otherwise
		// reflow them into one paragraph.
		expect(render('Line one\nLine two')).toContain('<br>');
	});
});
