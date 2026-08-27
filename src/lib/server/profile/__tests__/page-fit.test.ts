/**
 * The URL the page counter renders.
 *
 * Worth its own file for one reason: the counter's whole job is to answer about
 * the document the applicant will actually send, and it spent its life
 * answering about a different one. It omitted the presentation template, so a
 * version fitted to two pages came out of a branded template at three — two
 * pages plain, three with `template=citrus`, same version, same content.
 *
 * Nothing could catch that. A mocked browser sees a string it does not read,
 * and the page count came back a plausible number either way.
 */
import { describe, expect, it } from 'vitest';
import { renderRoute } from '../page-fit';

describe('renderRoute', () => {
	it('asks for the version being fitted', () => {
		expect(renderRoute('rik-wanders', 'resume', 'app-62')).toContain('?version=app-62');
	});

	it('carries the template, which is the whole point', () => {
		expect(renderRoute('rik-wanders', 'resume', 'app-62', 'citrus')).toContain('&template=citrus');
	});

	it('leaves the plain renderer unnamed, as the export path does', () => {
		for (const plain of [null, '', '   ', 'default']) {
			expect(renderRoute('rik-wanders', 'resume', 'app-62', plain)).not.toContain('template=');
		}
	});

	it('renders a CV from the cv route and everything else from resume', () => {
		expect(renderRoute('rik', 'cv', 'v1')).toContain('/p/rik/cv?');
		expect(renderRoute('rik', 'resume', 'v1')).toContain('/p/rik/resume?');
		expect(renderRoute('rik', 'anything-else', 'v1')).toContain('/p/rik/resume?');
	});

	it('escapes slugs rather than letting them shape the query', () => {
		const url = renderRoute('rik', 'resume', 'a&b=c', 'x y');
		expect(url).toContain('version=a%26b%3Dc');
		expect(url).toContain('template=x%20y');
	});
});
