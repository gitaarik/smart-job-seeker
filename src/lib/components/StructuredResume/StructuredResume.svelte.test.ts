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
