import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { shapeHtmlShell } from '../html-shell';

const SHELL =
	'<html lang="en" prefix="og: https://ogp.me/ns#" class="theme-light"><body></body></html>';

describe('shapeHtmlShell', () => {
	it('writes the document language onto the root tag', () => {
		expect(shapeHtmlShell(SHELL, 'light', 'nl')).toContain('<html lang="nl" ');
	});

	it('keeps English when the page set no language, or one it does not know', () => {
		expect(shapeHtmlShell(SHELL, 'light', undefined)).toContain('<html lang="en" ');
		expect(shapeHtmlShell(SHELL, 'light', 'xx')).toContain('<html lang="en" ');
	});

	it('leaves a lang attribute in the page body alone', () => {
		const chunk = '<blockquote lang="en">quoted</blockquote>';
		expect(shapeHtmlShell(chunk, 'light', 'nl')).toBe(chunk);
	});

	it('still applies the theme', () => {
		expect(shapeHtmlShell(SHELL, 'dark', 'nl')).toContain('class="theme-dark"');
	});

	it('matches what app.html actually says', () => {
		const appHtml = readFileSync(join(import.meta.dirname, '../../../app.html'), 'utf8');
		expect(appHtml).toContain('<html lang="en"');
		expect(appHtml).toContain('class="theme-light"');
	});
});
