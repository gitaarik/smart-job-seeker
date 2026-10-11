import { describe, expect, it } from 'vitest';
import {
	BUILT_IN_SECTIONS,
	documentSections,
	TEMPLATE_DEFAULT_SECTIONS
} from '$lib/resume-templates';

/**
 * What a document prints in a template (documentSections): the one answer the
 * renderer, coverage and tailoring all read, so none of them weighs a part the
 * page leaves out.
 */
describe('documentSections', () => {
	it('answers for the built-in layout when there is no template', () => {
		expect(documentSections(null)).toEqual({ technologies: false, sideProjects: true });
		expect(documentSections(undefined)).toEqual(BUILT_IN_SECTIONS);
	});

	it('gives a template that says nothing what the generic renderer always printed', () => {
		// Citrus, and every template made before a template could choose.
		expect(documentSections({ config: {} })).toEqual({ technologies: true, sideProjects: false });
		expect(documentSections({ config: null })).toEqual(TEMPLATE_DEFAULT_SECTIONS);
	});

	it('takes each part the config chooses, and the default for the rest', () => {
		expect(documentSections({ config: { sections: { sideProjects: true } } })).toEqual({
			technologies: true,
			sideProjects: true
		});
		expect(documentSections({ config: { sections: { technologies: false } } })).toEqual({
			technologies: false,
			sideProjects: false
		});
	});

	it('reads anything but a boolean as unset, since the config is jsonb', () => {
		const config = { sections: { sideProjects: 'yes', technologies: null } } as never;
		expect(documentSections({ config })).toEqual(TEMPLATE_DEFAULT_SECTIONS);
	});

	it('hands out a copy, so a caller cannot change the defaults', () => {
		const sections = documentSections(null);
		sections.sideProjects = false;
		expect(documentSections(null).sideProjects).toBe(true);
	});
});
