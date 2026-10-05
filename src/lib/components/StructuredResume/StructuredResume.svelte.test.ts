import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import type { ComponentProps } from 'svelte';
import StructuredResume from './StructuredResume.svelte';

type Profile = ComponentProps<typeof StructuredResume>['profile'];

/**
 * The certificate block of the renderer every DB-backed template goes through.
 *
 * Until 2026-09-26 it printed contact details, work, education and skills, and
 * no certificate at all: a certificate reached the default layout only, so on a
 * branded CV the section simply did not exist.
 */

vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/p/alex-morgan/cv') } }));

const profile = (certificates: NonNullable<Profile['certificates']>): Profile => ({
	name: 'Alex Morgan',
	title: null,
	subtitle: null,
	email_address: null,
	phone_number: null,
	location: null,
	personal_website: null,
	linkedin_profile: null,
	github_profile: null,
	summary: null,
	work_experiences: [],
	educations: [],
	tech_skill_categories: [],
	profile_versions: [],
	certificates
});

describe('StructuredResume — certificates', () => {
	test('prints each certificate on its own line, validity as years', () => {
		render(StructuredResume, {
			props: {
				config: {},
				profile: profile([
					{
						name: 'Certified Kubernetes Administrator',
						issuer: 'The Linux Foundation',
						date: '2023-03-15',
						expiry_date: '2025-03-15'
					},
					{ name: 'PRINCE2 Foundation', issuer: null, date: '2019-06-01', expiry_date: null }
				])
			}
		});

		expect(screen.getByText('Certificates')).toBeTruthy();
		expect(
			screen.getByText('Certified Kubernetes Administrator – The Linux Foundation, 2023 - 2025')
		).toBeTruthy();
		expect(screen.getByText('PRINCE2 Foundation – 2019')).toBeTruthy();
	});

	test('prints no section for a profile without certificates', () => {
		render(StructuredResume, { props: { config: {}, profile: profile([]) } });
		expect(screen.queryByText('Certificates')).toBeNull();
	});
});

/**
 * The references block, added 2026-10-05. Before, this renderer printed none,
 * so a branded resume could not carry one even for a job that asked for them.
 * Same rule as the default layout: the CV prints them, the resume prints the
 * ones its version decided to show.
 */
describe('StructuredResume — references', () => {
	const references = [
		{
			id: 13,
			author: 'Elmar Krack',
			author_position: 'Co-founder of Tender-it',
			text: 'Rik took ownership of our platform.'
		},
		{ id: 14, author: 'Michaël de Groot', author_position: null, text: 'A pleasure to work with.' }
	];
	const withReferences = (overrides: Array<Record<string, unknown>> = []): Profile => ({
		...profile([]),
		references,
		profile_versions: [{ id: 5, slug: 'app-91', toggles: [], extension_links: [], overrides }]
	});

	test('prints none on a resume whose version decided nothing about them', () => {
		render(StructuredResume, {
			props: { config: {}, type: 'resume', versionId: 5, profile: withReferences() }
		});
		expect(screen.queryByText('References')).toBeNull();
		expect(screen.queryByText('Elmar Krack, Co-founder of Tender-it')).toBeNull();
	});

	test('prints every reference on a CV, with the note that contact details are on request', () => {
		render(StructuredResume, {
			props: { config: {}, type: 'cv', versionId: 5, profile: withReferences() }
		});
		expect(screen.getByText('References')).toBeTruthy();
		expect(screen.getByText('Elmar Krack, Co-founder of Tender-it')).toBeTruthy();
		expect(screen.getByText('“Rik took ownership of our platform.”')).toBeTruthy();
		// No position, no dangling comma.
		expect(screen.getByText('Michaël de Groot')).toBeTruthy();
		expect(screen.getByText('Contact details available upon request')).toBeTruthy();
	});

	test('prints the one this resume’s version put on, in the document’s language', () => {
		render(StructuredResume, {
			props: {
				config: {},
				type: 'resume',
				versionId: 5,
				locale: 'nl',
				profile: withReferences([{ entity_type: 'reference', entity_id: 13, action: 'include' }])
			}
		});
		expect(screen.getByText('Referenties')).toBeTruthy();
		expect(screen.getByText('Elmar Krack, Co-founder of Tender-it')).toBeTruthy();
		expect(screen.queryByText('Michaël de Groot')).toBeNull();
	});
});
