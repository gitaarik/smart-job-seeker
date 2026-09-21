import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ExternalLink from './ExternalLink.svelte';
import { createRawSnippet } from 'svelte';

/**
 * The scheme guard, which is the whole reason this component exists as more
 * than a lint convenience.
 *
 * Most hrefs reaching it are typed by a user into their own profile or scraped
 * off a job board, and profile documents render on public `/p/[slug]` pages. An
 * `href` is one of the few places a string still executes: `javascript:` and
 * `data:` both run on click. Before this component those URLs went straight
 * into the markup at 27 separate call sites.
 */

const label = createRawSnippet(() => ({ render: () => '<span>link</span>' }));

const hrefOf = (href: string) => {
	render(ExternalLink, { props: { href, children: label } });
	return screen.getByText('link').closest('a')?.getAttribute('href');
};

describe('ExternalLink', () => {
	test.each(['https://example.com/a', 'http://example.com', 'mailto:a@b.co', 'tel:+3161234567'])(
		'renders %s, which a link is allowed to be',
		(href) => {
			expect(hrefOf(href)).toBe(href);
		}
	);

	// Rendered as inert text rather than `#`: a link that silently goes nowhere
	// reads as a broken page, where plain text reads as a URL we would not follow.
	test.each([
		'javascript:alert(1)',
		'JavaScript:alert(1)',
		'data:text/html,<script>alert(1)</script>',
		'vbscript:msgbox(1)'
	])('drops %s rather than rendering it', (href) => {
		expect(hrefOf(href)).toBeNull();
	});

	test('drops a string that is not a URL at all', () => {
		expect(hrefOf('http://[')).toBeNull();
	});

	// The columns behind these links are nullable: an optional certificate link,
	// an employer website, a side project's URL.
	test.each([null, undefined, ''])('renders no href for %p', (href) => {
		render(ExternalLink, { props: { href: href as string | null, children: label } });
		expect(screen.getByText('link').closest('a')?.getAttribute('href')).toBeNull();
	});

	test('opens safely in a new tab by default', () => {
		render(ExternalLink, { props: { href: 'https://example.com', children: label } });
		const a = screen.getByText('link').closest('a');
		expect(a?.getAttribute('target')).toBe('_blank');
		expect(a?.getAttribute('rel')).toBe('noopener noreferrer');
	});

	test('lets a caller override the target', () => {
		render(ExternalLink, {
			props: { href: 'https://example.com', target: '_self', children: label }
		});
		expect(screen.getByText('link').closest('a')?.getAttribute('target')).toBe('_self');
	});
});
