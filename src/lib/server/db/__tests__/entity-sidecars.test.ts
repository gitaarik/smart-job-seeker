/**
 * Every kind of row that a CV version's override or a translation may name
 * has a delete trigger taking those with it (`delete_entity_sidecars`; see
 * profile_version_overrides in schema.ts).
 *
 * The triggers are SQL in the migrations and the vocabularies are TypeScript,
 * so nothing else notices an entity type arriving without one. Its overrides
 * and translations would then outlive every deleted row again, which is how 11
 * overrides came to name skills that no longer existed.
 */

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getTableName } from 'drizzle-orm';
import { FIELD_VARIANT_ENTITY } from '$lib/field-variants';
import { OVERRIDE_ENTITY_TYPES } from '$lib/version-overrides';
import { PROFILE_RESOURCES } from '$lib/server/profile/resources';
import { profile_field_variants } from '../schema';

const TRIGGER =
	/CREATE TRIGGER \w+ AFTER DELETE ON "(\w+)"\s+REFERENCING OLD TABLE AS gone FOR EACH STATEMENT\s+EXECUTE FUNCTION delete_entity_sidecars\('(\w+)'\)/g;

/** Entity type to the table its trigger is on, across every migration. */
function sidecarTriggers(): Map<string, string> {
	const dir = fileURLToPath(new URL('../../../../../drizzle/', import.meta.url));
	const triggers = new Map<string, string>();
	for (const file of readdirSync(dir).filter((name) => name.endsWith('.sql'))) {
		for (const [, table, entity] of readFileSync(dir + file, 'utf8').matchAll(TRIGGER)) {
			triggers.set(entity, table);
		}
	}
	return triggers;
}

describe('entity sidecar delete triggers', () => {
	const triggers = sidecarTriggers();

	it('finds the triggers at all', () => {
		// A pattern that stopped matching would pass everything below vacuously.
		expect(triggers.size).toBeGreaterThan(0);
	});

	it('covers every entity an override can name', () => {
		for (const entity of OVERRIDE_ENTITY_TYPES) {
			expect(triggers.has(entity), entity).toBe(true);
		}
	});

	it('covers every translated row, on the table that row lives in', () => {
		for (const [name, resource] of Object.entries(PROFILE_RESOURCES)) {
			if (!resource.translationEntity) continue;
			expect(triggers.get(resource.translationEntity), name).toBe(getTableName(resource.table));
		}
		expect(triggers.get(FIELD_VARIANT_ENTITY)).toBe(getTableName(profile_field_variants));
	});
});
