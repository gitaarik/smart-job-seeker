import { describe, expect, it } from 'vitest';
import { resumeDocumentDescription, resumeDocumentTitle } from '../resume-head';

const profile = {
	name: 'Rik Wanders',
	title: 'Senior Full-Stack Engineer',
	subtitle: 'Python / Node.js web applications at scale'
};

describe('resumeDocumentTitle', () => {
	it('joins the name and the title', () => {
		expect(resumeDocumentTitle(profile)).toBe('Rik Wanders — Senior Full-Stack Engineer');
	});

	it('falls back to the name alone without a title', () => {
		expect(resumeDocumentTitle({ ...profile, title: null })).toBe('Rik Wanders');
		expect(resumeDocumentTitle({ ...profile, title: '  ' })).toBe('Rik Wanders');
	});
});

describe('resumeDocumentDescription', () => {
	it('joins the title and the subtitle', () => {
		expect(resumeDocumentDescription(profile)).toBe(
			'Senior Full-Stack Engineer — Python / Node.js web applications at scale'
		);
	});

	it('uses whichever half of the headline is set', () => {
		expect(resumeDocumentDescription({ ...profile, subtitle: null })).toBe(
			'Senior Full-Stack Engineer'
		);
		expect(resumeDocumentDescription({ ...profile, title: null })).toBe(
			'Python / Node.js web applications at scale'
		);
	});

	it('falls back to the name when there is no headline', () => {
		expect(resumeDocumentDescription({ ...profile, title: null, subtitle: null })).toBe(
			'Rik Wanders'
		);
	});
});
