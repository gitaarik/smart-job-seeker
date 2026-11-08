import { describe, expect, it } from 'vitest';
import { bannerHtml, contentBox } from '../banners';

const look = {
	background: '#000000',
	text: '#ffffff',
	accent: '#ff0000',
	muted: '#999999',
	headingFont: 'Poppins',
	bodyFont: 'Noto Sans'
};

describe('contentBox', () => {
	it('keeps the words clear of a covered corner on their side', () => {
		const covered = [{ kind: 'covered' as const, x: 0, y: 200, w: 450, h: 196 }];
		const box = contentBox(1584, 396, covered, 'left');
		expect(box.left).toBeGreaterThanOrEqual(450);
	});

	it('ignores a covered corner on the other side', () => {
		const covered = [{ kind: 'covered' as const, x: 0, y: 200, w: 450, h: 196 }];
		const box = contentBox(1584, 396, covered, 'right');
		expect(box.left).toBeLessThan(450);
	});

	it('stays inside the safe zone', () => {
		const safe = [{ kind: 'safe' as const, x: 0, y: 60, w: 1500, h: 380 }];
		const box = contentBox(1500, 500, safe, 'center');
		expect(box.top).toBeGreaterThanOrEqual(60);
		expect(box.bottom).toBeLessThanOrEqual(440);
	});
});

describe('bannerHtml', () => {
	it('escapes the words it prints', () => {
		const html = bannerHtml(
			{ name: '<script>alert(1)</script>', line: 'A & B', tagline: '"quoted"' },
			look,
			{ logo: null, background: null },
			{ width: 1584, height: 396, zones: [], align: 'right' }
		);
		expect(html).not.toContain('<script>alert');
		expect(html).toContain('&lt;script&gt;');
		expect(html).toContain('A &amp; B');
		expect(html).toContain('width: 1584px; height: 396px');
	});
});
