/**
 * Multi-language resume/CV export.
 *
 * English is the canonical/base language — it stays in the profile's existing
 * columns. Every other language is a sparse OVERLAY stored in the
 * `profile_translations` sidecar table (see schema.ts): one row per
 * (entity_type, entity_id, field, locale). A missing translation falls back to
 * the English base value, so partial translations never block an export.
 *
 * This registry is the single source of truth for WHICH fields are
 * translatable. It drives both the editor UI (which inputs get a language
 * switcher) and the export resolver (which fields to overlay). Same pattern as
 * resume-contact-fields.ts.
 *
 * Client-safe: pure data + helpers, no DB. The resolver lives server-side in
 * server/profile/translations.ts.
 */

/** Canonical language; never stored in profile_translations. */
export const BASE_LOCALE = "en";

export interface LocaleDef {
  code: string;
  label: string; // English name
  nativeLabel: string; // endonym, shown in the switcher
}

/** Languages the UI offers. English is always the base and never stored. */
export const LOCALES: LocaleDef[] = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "nl", label: "Dutch", nativeLabel: "Nederlands" },
  { code: "de", label: "German", nativeLabel: "Deutsch" },
  { code: "fr", label: "French", nativeLabel: "Français" },
  { code: "es", label: "Spanish", nativeLabel: "Español" },
];

export function isKnownLocale(code: string | null | undefined): code is string {
  return !!code && LOCALES.some((l) => l.code === code);
}

/** A translatable text field on some profile entity. */
export interface TranslatableField {
  /** Stable key persisted in profile_translations.entity_type. */
  entity: string;
  /** Column/field name persisted in profile_translations.field. */
  field: string;
  /** Human label for the editor UI switcher. */
  label: string;
}

/**
 * Every field that can be translated, grouped by entity. The `entity` and
 * `field` values are stable strings persisted in the DB — renaming one orphans
 * existing rows, so treat this as an append-only vocabulary.
 */
export const TRANSLATABLE_FIELDS: TranslatableField[] = [
  { entity: "profile", field: "summary", label: "Summary" },
  { entity: "profile", field: "headline", label: "Headline" },
  { entity: "profile", field: "subtitle", label: "Subtitle" },
  { entity: "profile", field: "title", label: "Title" },
  { entity: "profile", field: "about_me_text", label: "About me" },

  { entity: "work_experience", field: "position", label: "Position" },
  { entity: "work_experience", field: "headline", label: "Headline" },
  { entity: "work_experience", field: "summary", label: "Summary" },
  { entity: "work_experience", field: "description", label: "Description" },

  {
    entity: "work_experience_achievement",
    field: "description",
    label: "Achievement",
  },

  { entity: "tech_skill_category", field: "name", label: "Category name" },

  { entity: "education", field: "area", label: "Field of study" },
  { entity: "education", field: "study_type", label: "Degree" },
  { entity: "education", field: "summary", label: "Summary" },

  { entity: "side_project", field: "name", label: "Name" },
  { entity: "side_project", field: "summary", label: "Summary" },

  {
    entity: "side_project_achievement",
    field: "description",
    label: "Achievement",
  },
];

const FIELD_SET = new Set(
  TRANSLATABLE_FIELDS.map((f) => `${f.entity}:${f.field}`),
);

export function isTranslatable(entity: string, field: string): boolean {
  return FIELD_SET.has(`${entity}:${field}`);
}

export function fieldsForEntity(entity: string): TranslatableField[] {
  return TRANSLATABLE_FIELDS.filter((f) => f.entity === entity);
}

/** One editable field row in the translations editor (base + metadata). */
export interface TranslatableRow {
  entity: string;
  id: number;
  field: string;
  label: string;
  base: string;
  multiline: boolean;
}

/** A titled group of rows (a work experience, the profile, skills, …). */
export interface TranslatableGroup {
  key: string;
  title: string;
  rows: TranslatableRow[];
}

/** Map key shared by the resolver and the translations lookup. */
export function translationKey(
  entity: string,
  entityId: number | string,
  field: string,
): string {
  return `${entity}:${entityId}:${field}`;
}
