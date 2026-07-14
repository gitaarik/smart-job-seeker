import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { and, eq } from "drizzle-orm";
import { profile_translations } from "$lib/server/db/schema";
import { requireAuth } from "$lib/server/utils/api-helpers";
import { getSelectedProfileId } from "$lib/server/profile/selected-profile";
import { getProfileByIdentifier } from "$lib/server/profile/default";
import { collectTranslatable } from "$lib/server/profile/translations";
import { touchProfile } from "$lib/server/profile/touch-profile";
import {
  translateFields,
  type FieldToTranslate,
} from "$lib/server/profile/auto-translate";
import {
  BASE_LOCALE,
  isKnownLocale,
  translationKey,
} from "$lib/resume-translations";

/**
 * Auto-translate profile fields into a target language via the configured LLM
 * and store the results. Two modes:
 *   - single field: body has `entity`, `id`, `field` → translate just that one.
 *   - whole profile: omit those → translate every translatable field, skipping
 *     ones already translated unless `overwrite` is true.
 */
export const POST: RequestHandler = async ({ locals, cookies, request }) => {
  const user = requireAuth(locals);
  const profileId = await getSelectedProfileId(cookies, user.id);
  if (!profileId) error(400, "No profile selected");

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") error(400, "Invalid body");

  const locale = String(body.locale ?? "");
  if (!isKnownLocale(locale) || locale === BASE_LOCALE) {
    error(400, "Invalid language");
  }
  const overwrite = body.overwrite === true;
  const single = body.entity != null && body.id != null && body.field != null;

  // Every translatable field with English content (also proves ownership: the
  // rows come from the caller's own profile tree).
  const profile = await getProfileByIdentifier(profileId);
  const allRows: FieldToTranslate[] = collectTranslatable(profile)
    .flatMap((g) => g.rows)
    .map((r) => ({ entity: r.entity, id: r.id, field: r.field, base: r.base }));

  let targets: FieldToTranslate[];
  if (single) {
    const entity = String(body.entity);
    const field = String(body.field);
    const id = Number(body.id);
    const match = allRows.find(
      (r) => r.entity === entity && r.id === id && r.field === field,
    );
    if (!match) error(404, "Field not found");
    targets = [match];
  } else {
    targets = allRows;
    if (!overwrite) {
      const existing = await db
        .select({
          entity_type: profile_translations.entity_type,
          entity_id: profile_translations.entity_id,
          field: profile_translations.field,
        })
        .from(profile_translations)
        .where(and(
          eq(profile_translations.profile_id, profileId),
          eq(profile_translations.locale, locale),
        ));
      const done = new Set(
        existing.map((e) =>
          translationKey(e.entity_type, e.entity_id, e.field)
        ),
      );
      targets = targets.filter(
        (r) => !done.has(translationKey(r.entity, r.id, r.field)),
      );
    }
  }

  if (targets.length === 0) {
    return json({ translations: [], count: 0 });
  }

  let translated: Map<number, string>;
  try {
    translated = await translateFields(targets, locale);
  } catch (e) {
    console.error("[auto-translate] LLM error:", e);
    error(502, "Translation service failed");
  }

  const now = new Date();
  const written: Array<{
    entity: string;
    id: number;
    field: string;
    locale: string;
    value: string;
  }> = [];

  for (let i = 0; i < targets.length; i++) {
    const value = translated.get(i);
    if (!value) continue;
    const t = targets[i];
    await db
      .insert(profile_translations)
      .values({
        profile_id: profileId,
        entity_type: t.entity,
        entity_id: t.id,
        field: t.field,
        locale,
        value,
        date_created: now,
        date_updated: now,
      })
      .onConflictDoUpdate({
        target: [
          profile_translations.profile_id,
          profile_translations.entity_type,
          profile_translations.entity_id,
          profile_translations.field,
          profile_translations.locale,
        ],
        set: { value, date_updated: now },
      });
    written.push({
      entity: t.entity,
      id: t.id,
      field: t.field,
      locale,
      value,
    });
  }

  if (written.length > 0) await touchProfile(profileId);

  return json({ translations: written, count: written.length });
};
