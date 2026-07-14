import { dbDirect as db } from "$lib/server/db";
import { profile_translations } from "$lib/server/db/schema";
import { getProfileByIdentifier } from "$lib/server/profile/default";
import { collectTranslatable } from "$lib/server/profile/translations";
import { translateFields } from "$lib/server/profile/auto-translate";
import { generateVersionPdfs } from "$lib/server/profile/generate-version-pdfs";
import { getLatestExportWithFile } from "$lib/server/profile/export-files";

const PROFILE = 1, LOCALE = "nl";
const profile: any = await getProfileByIdentifier(PROFILE);
const rows = collectTranslatable(profile).flatMap((g) => g.rows);
console.error(`retranslating ${rows.length} fields (new prompt)…`);
const map = await translateFields(rows.map((r) => ({ entity: r.entity, id: r.id, field: r.field, base: r.base })), LOCALE);

const now = new Date();
for (let i = 0; i < rows.length; i++) {
  const value = map.get(i); if (!value) continue; const r = rows[i];
  await db.insert(profile_translations).values({
    profile_id: PROFILE, entity_type: r.entity, entity_id: r.id, field: r.field, locale: LOCALE, value, date_created: now, date_updated: now,
  }).onConflictDoUpdate({
    target: [profile_translations.profile_id, profile_translations.entity_type, profile_translations.entity_id, profile_translations.field, profile_translations.locale],
    set: { value, date_updated: now },
  });
}

console.error("\n=== spot-check (fields where Citrus AI beat us) ===");
for (let i = 0; i < rows.length; i++) {
  const r = rows[i]; const v = map.get(i); if (!v) continue;
  if ((r.entity === "profile" && r.field === "summary") ||
      (r.group === "Work experience — Rik Wanders Software" && r.entity === "work_experience_achievement") ||
      (r.entity === "tech_skill_category" && r.field === "name")) {
    console.error(`[${r.label}] ${v}`);
  }
}

console.error("\ngenerating citrus CV (nl)…");
await generateVersionPdfs(PROFILE, "citrus", "citrus", "nl");
const res = await getLatestExportWithFile({ profileId: PROFILE, exportType: "cv", fileType: "pdf", exportFormat: "citrus", template: "citrus", locale: "nl" });
if (!res) { console.error("NO EXPORT"); process.exit(1); }
console.error("pdf bytes:", res.buffer.length);
console.log("BASE64:" + Buffer.from(res.buffer).toString("base64"));
