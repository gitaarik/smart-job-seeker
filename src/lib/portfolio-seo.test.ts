import { describe, expect, it } from 'vitest';
import { absoluteUrl, isSiteUrl, personJsonLd, portfolioSeoUrls } from './portfolio-seo';

const APP = 'https://dev.example.com/';

describe('portfolioSeoUrls', () => {
	it("points at the app's own page without a site address", () => {
		expect(portfolioSeoUrls({}, APP, 'jane-doe')).toEqual({
			canonicalUrl: 'https://dev.example.com/p/jane-doe/portfolio',
			appUrl: 'https://dev.example.com'
		});
	});

	it("points at the theme's site address when it has one", () => {
		const urls = portfolioSeoUrls({ siteUrl: ' https://jane.example/ ' }, APP, 'jane-doe');
		expect(urls.canonicalUrl).toBe('https://jane.example/');
		expect(urls.appUrl).toBe('https://dev.example.com');
	});

	it('ignores a site address that is not a web URL', () => {
		const urls = portfolioSeoUrls({ siteUrl: 'javascript:alert(1)' }, APP, 'jane-doe');
		expect(urls.canonicalUrl).toBe('https://dev.example.com/p/jane-doe/portfolio');
	});
});

describe('isSiteUrl', () => {
	it('takes http(s) URLs only', () => {
		expect(isSiteUrl('https://jane.example')).toBe(true);
		expect(isSiteUrl('jane.example')).toBe(false);
		expect(isSiteUrl(null)).toBe(false);
	});
});

describe('absoluteUrl', () => {
	it('resolves an asset path against the app', () => {
		expect(absoluteUrl('/assets/abc', 'https://dev.example.com')).toBe(
			'https://dev.example.com/assets/abc'
		);
	});

	it('passes an absolute URL through and nothing as nothing', () => {
		expect(absoluteUrl('https://cdn.example/x.png', 'https://dev.example.com')).toBe(
			'https://cdn.example/x.png'
		);
		expect(absoluteUrl(null, 'https://dev.example.com')).toBeNull();
	});
});

describe('personJsonLd', () => {
	const urls = { canonicalUrl: 'https://jane.example/', appUrl: 'https://dev.example.com' };

	it('describes the person with absolute links and no contact details', () => {
		const person = JSON.parse(
			personJsonLd(
				{
					name: 'Jane Doe',
					title: 'Engineer',
					headline: 'Builds things',
					email_address: 'jane@example.com',
					phone_number: '+31 6 0000 0000',
					linkedin_profile: 'https://www.linkedin.com/in/jane',
					github_profile: 'github.com/jane',
					personal_website: 'https://jane.example/'
				},
				{ assets: { photo: 'photo-id' } },
				urls
			)
		);
		expect(person).toEqual({
			'@context': 'https://schema.org',
			'@type': 'Person',
			name: 'Jane Doe',
			jobTitle: 'Engineer',
			description: 'Builds things',
			url: 'https://jane.example/',
			image: 'https://dev.example.com/assets/photo-id',
			sameAs: ['https://www.linkedin.com/in/jane']
		});
	});

	it('cannot close the script element it is printed in', () => {
		const body = personJsonLd({ name: '</script><script>alert(1)</script>' }, {}, urls);
		expect(body).not.toContain('<');
		expect(JSON.parse(body).name).toBe('</script><script>alert(1)</script>');
	});
});
