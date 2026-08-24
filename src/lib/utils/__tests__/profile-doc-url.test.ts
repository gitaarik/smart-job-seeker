/**
 * The URL a document is served at, and the key it is stored under.
 *
 * Both functions here encode the same rule twice: the built-in template and
 * the base English are *absences* — omitted from the URL, `null` in
 * `profile_exports` — while the UI carries them as the live values `'default'`
 * and `'en'`. `exportKey` is called from both sides of that split (the server
 * builds keys from stored rows, the client builds one from whatever the picker
 * currently shows) and the two must land on the same string, or "is there a
 * PDF for what I picked" answers no while the PDF sits right there.
 *
 * Nothing throws when they disagree; the download button just quietly stops
 * appearing. So the drift is what these tests are for.
 */
import { describe, expect, it } from 'vitest';
import { exportKey, profileDocUrl } from '../profile-doc-url';

describe('profileDocUrl', () => {
	it('serves the plain document from the profile slug', () => {
		expect(profileDocUrl({ profileSlug: 'rik', docType: 'resume' })).toBe('/p/rik/resume');
		expect(profileDocUrl({ profileSlug: 'rik', docType: 'cv' })).toBe('/p/rik/cv');
	});

	it('asks for the PDF by extension, not by parameter', () => {
		expect(profileDocUrl({ profileSlug: 'rik', docType: 'cv', pdf: true })).toBe('/p/rik/cv.pdf');
	});

	it('names a version', () => {
		expect(
			profileDocUrl({ profileSlug: 'rik', docType: 'resume', versionSlug: 'backend-2026' })
		).toBe('/p/rik/resume?version=backend-2026');
	});

	// The public version is what the bare URL already serves, so naming it would
	// make a shared link longer and no more specific.
	it('leaves the version off when it is the public one', () => {
		expect(
			profileDocUrl({
				profileSlug: 'rik',
				docType: 'resume',
				versionSlug: 'backend-2026',
				isPublicVersion: true
			})
		).toBe('/p/rik/resume');
	});

	it('omits the default template and the base language', () => {
		expect(
			profileDocUrl({ profileSlug: 'rik', docType: 'cv', template: 'default', locale: 'en' })
		).toBe('/p/rik/cv');
		expect(profileDocUrl({ profileSlug: 'rik', docType: 'cv', template: null, locale: null })).toBe(
			'/p/rik/cv'
		);
	});

	it('names a non-default template and a non-base language', () => {
		expect(profileDocUrl({ profileSlug: 'rik', docType: 'cv', template: 'citrus' })).toBe(
			'/p/rik/cv?template=citrus'
		);
		expect(profileDocUrl({ profileSlug: 'rik', docType: 'cv', locale: 'nl' })).toBe(
			'/p/rik/cv?lang=nl'
		);
	});

	it('carries all four lenses at once', () => {
		expect(
			profileDocUrl({
				profileSlug: 'rik',
				docType: 'cv',
				versionSlug: 'backend-2026',
				template: 'citrus',
				locale: 'nl',
				pdf: true
			})
		).toBe('/p/rik/cv.pdf?version=backend-2026&template=citrus&lang=nl');
	});

	it('escapes what it puts in the query string', () => {
		expect(profileDocUrl({ profileSlug: 'rik', docType: 'cv', versionSlug: 'a b&c' })).toBe(
			'/p/rik/cv?version=a+b%26c'
		);
	});
});

describe('exportKey', () => {
	// The whole point of the function: the same document, described by the two
	// sides that describe it differently, is one key.
	it('reads the UI form and the storage form as the same document', () => {
		const fromStorage = exportKey('cv', 'backend-2026', null, null);
		const fromPicker = exportKey('cv', 'backend-2026', 'default', 'en');
		expect(fromPicker).toBe(fromStorage);
	});

	it('treats an absent version the same however it is absent', () => {
		expect(exportKey('cv', null, null, null)).toBe(exportKey('cv', undefined, null, null));
		expect(exportKey('cv', '', null, null)).toBe(exportKey('cv', null, null, null));
	});

	it('separates documents that differ in any one lens', () => {
		const base = exportKey('cv', 'backend-2026', null, null);
		expect(exportKey('resume', 'backend-2026', null, null)).not.toBe(base);
		expect(exportKey('cv', 'frontend-2026', null, null)).not.toBe(base);
		expect(exportKey('cv', 'backend-2026', 'citrus', null)).not.toBe(base);
		expect(exportKey('cv', 'backend-2026', null, 'nl')).not.toBe(base);
	});

	// Positional, so a value cannot slide from one field into another: a Dutch
	// export is not a "nl" template.
	it('does not confuse one lens for another', () => {
		expect(exportKey('cv', '', 'nl', null)).not.toBe(exportKey('cv', '', null, 'nl'));
		expect(exportKey('cv', 'citrus', null, null)).not.toBe(exportKey('cv', '', 'citrus', null));
	});
});
