import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import type { ComponentProps } from 'svelte';
import ProfileDisplay from './ProfileDisplay.svelte';

type Profile = ComponentProps<typeof ProfileDisplay>['profile'];

/**
 * The references section of the built-in layout.
 *
 * It used to print on the CV and nowhere else, hard-wired, so the resume going
 * to a job that asked for references could not carry them. The CV still prints
 * them all; a resume prints the ones its version decided to show.
 */

vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/p/alex-morgan/resume') } }));

const references = [
	{
		id: 13,
		author: 'Elmar Krack',
		author_position: 'Co-founder of Tender-it',
		text: 'Rik took ownership of our platform.'
	},
	{ id: 14, author: 'Michaël de Groot', author_position: null, text: 'A pleasure to work with.' }
];

const profile = (overrides: Array<Record<string, unknown>> = []): Profile => ({
	name: 'Alex Morgan',
	title: null,
	subtitle: null,
	email_address: null,
	phone_number: null,
	location: null,
	location_url: null,
	personal_website: null,
	linkedin_profile: null,
	github_profile: null,
	summary: null,
	work_experiences: [],
	educations: [],
	languages: [],
	certificates: [],
	references,
	tech_skill_categories: [],
	side_projects: [],
	highlights: [],
	profile_versions: [{ id: 5, slug: 'app-91', toggles: [], extension_links: [], overrides }]
});

describe('ProfileDisplay — references', () => {
	test('prints none on a resume whose version decided nothing about them', () => {
		render(ProfileDisplay, { props: { type: 'resume', versionId: 5, profile: profile() } });
		expect(screen.queryByText('REFERENCES')).toBeNull();
	});

	test('prints them all on a CV', () => {
		render(ProfileDisplay, { props: { type: 'cv', versionId: 5, profile: profile() } });
		expect(screen.getByText('REFERENCES')).toBeTruthy();
		expect(screen.getByText('"Rik took ownership of our platform."')).toBeTruthy();
		expect(screen.getByText('"A pleasure to work with."')).toBeTruthy();
	});

	test('prints the one this resume’s version put on, and no other', () => {
		render(ProfileDisplay, {
			props: {
				type: 'resume',
				versionId: 5,
				profile: profile([{ entity_type: 'reference', entity_id: 13, action: 'include' }])
			}
		});
		expect(screen.getByText('REFERENCES')).toBeTruthy();
		expect(screen.getByText('"Rik took ownership of our platform."')).toBeTruthy();
		expect(screen.queryByText('"A pleasure to work with."')).toBeNull();
		expect(screen.getByText('Contact details available upon request')).toBeTruthy();
	});
});
