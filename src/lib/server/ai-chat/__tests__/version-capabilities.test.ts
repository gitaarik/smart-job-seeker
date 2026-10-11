/**
 * The resume version verbs (version-capabilities.ts): what each refuses before
 * a request is made, that the three which change what is sent always ask, and
 * what a delete's request shows the applicant before they approve it.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/profile/versions', () => ({
	createVersion: vi.fn(),
	deleteVersion: vi.fn(),
	listLibraryVersions: vi.fn(async () => []),
	renameVersion: vi.fn(),
	restorePublicVersions: vi.fn(),
	setPublicVersion: vi.fn(),
	slugFromName: (name: string) => name.toLowerCase().replace(/\s+/g, '-'),
	VersionError: class VersionError extends Error {}
}));
vi.mock('$lib/server/profile/version-tags', () => ({ versionDeleteImpact: vi.fn() }));

import { VERSION_CAPABILITIES } from '../version-capabilities';
import { tierForWrite } from '$lib/server/mcp/tiers';

const { add_resume_version, rename_resume_version, delete_resume_version } = VERSION_CAPABILITIES;
const { set_public_resume_version } = VERSION_CAPABILITIES;

describe('validate', () => {
	it('refuses a new version under a reserved or used slug', () => {
		const taken = { taken_slugs: ['frontend'] };
		expect(add_resume_version.validate({ 'resume_version.name': 'AI Engineer' }, taken)).toEqual({
			ok: true
		});
		expect(add_resume_version.validate({ 'resume_version.name': 'Frontend' }, taken).ok).toBe(
			false
		);
		expect(
			add_resume_version.validate(
				{ 'resume_version.name': 'x', 'resume_version.slug': 'app-3' },
				taken
			).ok
		).toBe(false);
	});

	it('refuses a rename that changes nothing', () => {
		const current = {
			'resume_version.name': 'Frontend',
			'resume_version.slug': 'frontend',
			taken_slugs: []
		};
		expect(rename_resume_version.validate({ 'resume_version.name': 'Frontend' }, current).ok).toBe(
			false
		);
		expect(rename_resume_version.validate({ 'resume_version.slug': 'FRONTEND' }, current).ok).toBe(
			false
		);
		expect(rename_resume_version.validate({ 'resume_version.name': 'Front' }, current).ok).toBe(
			true
		);
	});

	it('refuses to move a delete’s items to a version they do not have', () => {
		const current = { taken_slugs: ['full-stack'] };
		expect(delete_resume_version.validate({}, current).ok).toBe(true);
		expect(
			delete_resume_version.validate({ 'resume_version.move_to': 'Full-Stack' }, current).ok
		).toBe(true);
		expect(delete_resume_version.validate({ 'resume_version.move_to': 'django' }, current).ok).toBe(
			false
		);
	});

	it('refuses to make public what already is', () => {
		const current = { 'resume_version.public_resume': true, 'resume_version.public_cv': false };
		expect(
			set_public_resume_version.validate({ 'resume_version.public_resume': true }, current).ok
		).toBe(false);
		expect(
			set_public_resume_version.validate({ 'resume_version.public_cv': true }, current).ok
		).toBe(true);
		expect(set_public_resume_version.validate({}, current).ok).toBe(false);
	});
});

describe('tiers', () => {
	const tier = (capability: string, fields: Record<string, unknown>, current = {}) =>
		tierForWrite({
			capability: capability as never,
			current,
			fields,
			recentDirectWrites: 0
		}).tier;

	it('applies a new version directly, and asks for the three that change what is sent', () => {
		expect(tier('add_resume_version', { 'resume_version.name': 'AI Engineer' })).toBe(1);
		// A delete sends no field at all, which the rule for filling empty fields
		// would otherwise read as nothing replaced.
		expect(tier('delete_resume_version', {})).toBe(2);
		// Naming a version that had no name fills an empty field, and still asks.
		expect(
			tier(
				'rename_resume_version',
				{ 'resume_version.name': 'AI Engineer' },
				{
					'resume_version.name': ''
				}
			)
		).toBe(2);
		expect(tier('set_public_resume_version', { 'resume_version.public_resume': true })).toBe(2);
	});
});

describe('a delete request', () => {
	it('shows everything it touches, read when it was asked for', () => {
		const lines = delete_resume_version.describeChanges!(
			{ 'resume_version.move_to': 'full-stack' },
			{
				name: 'Fullstack Django',
				impact: {
					onlyHere: [{ kind: 'Side project', label: 'Jazzchords' }],
					builtOnIt: 2,
					sentWith: 1,
					publicResume: true,
					publicCv: false
				}
			}
		);
		// The card strikes out "from": it must name the state that ends, never an
		// entry, which is not deleted.
		expect(lines.map((line) => [line.label, line.from, line.to])).toEqual([
			['Version', 'Fullstack Django', 'Deleted'],
			[
				'Tagged for this version only: Jazzchords (side project)',
				'Only on Fullstack Django',
				'On full-stack'
			],
			['Built on it: 2 versions', 'Starting from Fullstack Django', 'Their own choices only'],
			[
				'Sent with it: 1 application',
				'Linked to Fullstack Django',
				'Record kept, without the link'
			],
			['Public resume', 'Fullstack Django', 'Nothing public until another is picked']
		]);
	});
});
