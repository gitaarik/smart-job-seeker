/**
 * Every reference to a rendition has been decided: public or private.
 *
 * `/assets/<id>` serves a rendition only while a public slot points at it, and
 * that list is written down (an allowlist, see references.ts). A foreign key
 * to `media_renditions` added later must land in one list or the other, or
 * this fails, so nobody adds a slot that silently serves nothing, or a record
 * that silently serves a private picture to anyone.
 */
import { describe, expect, it } from 'vitest';
import {
	PRIVATE_RENDITION_REFERENCES,
	PUBLIC_RENDITION_REFERENCES,
	renditionReferences
} from '../references';

describe('references to media_renditions', () => {
	const found = renditionReferences().map((r) => `${r.table}.${r.column}`);

	it('are read from the schema', () => {
		expect(found).toContain('profiles.profile_photo_id');
		expect(found).toContain('application_media.rendition_id');
	});

	it('are each public or private, never both and never neither', () => {
		const decided = [...PUBLIC_RENDITION_REFERENCES, ...PRIVATE_RENDITION_REFERENCES];
		expect(new Set(decided).size).toBe(decided.length);
		expect([...found].sort()).toEqual([...decided].sort());
	});
});
