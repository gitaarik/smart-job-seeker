/**
 * Derive metadata for Activity records that never went through the pass.
 *
 * `deriveRecordMetadata` runs at write time — after a paste, or after a file
 * finishes extracting. So an entry written before the pass existed, or one
 * whose text arrived through the lazy extraction path in
 * `applicationActivityText` rather than through the `extract` action, keeps its
 * write-time fallbacks forever: a filename for a title, and `message` for the
 * type because that is what a file defaults to.
 *
 * That last one is not cosmetic. `record_type` is what RECORD_WEIGHTS budgets
 * and trims by, so a 45k interview transcript typed `message` is ranked as the
 * third thing to sacrifice and — in compact mode — capped at half what a
 * transcript gets. The entry is misfiled everywhere it matters: the type
 * filter, the trim order, the ceiling.
 *
 * Safe to re-run: `shouldDerive` gates on `derived_at`, so a second pass over
 * an already-derived record is a DB read and nothing more. Dry-run by default,
 * because each record it does process costs an LLM call.
 *
 * Note it fills rather than overwrites once a record has been edited
 * (`pickChanges`): a hand-corrected type or title always stands, so the counts
 * below separate the two cases rather than promising to fix them all.
 *
 *   # from cloud/oss, against whichever DB SJS_DATABASE_URL points at
 *   npx dotenvx run -f ../.env -- npx tsx scripts/backfill-record-derivation.ts
 *   npx dotenvx run -f ../.env -- npx tsx scripts/backfill-record-derivation.ts --apply
 *   … --apply --limit 20        # cap the spend on a first run
 */

import { dbDirect as db } from "$lib/server/db";
import { asc, eq, isNull } from "drizzle-orm";
import { application_records, applications } from "$lib/server/db/schema";
import {
  deriveRecordMetadata,
  shouldDerive,
} from "$lib/server/ai-chat/record-derivation";
import { summarizeApplication } from "$lib/server/ai-chat/application-summary";

const APPLY = process.argv.includes("--apply");
const LIMIT = (() => {
  const i = process.argv.indexOf("--limit");
  const n = i === -1 ? NaN : Number(process.argv[i + 1]);
  return Number.isFinite(n) && n > 0 ? n : Infinity;
})();

async function main() {
  const rows = await db
    .select({
      id: application_records.id,
      applicationId: application_records.application_id,
      profileId: applications.profile_id,
      recordType: application_records.record_type,
      title: application_records.title,
      content: application_records.content,
      derived_at: application_records.derived_at,
      date_updated: application_records.date_updated,
    })
    .from(application_records)
    .innerJoin(
      applications,
      eq(applications.id, application_records.application_id),
    )
    .where(isNull(application_records.derived_at))
    .orderBy(asc(application_records.id));

  // Ask the module, rather than restating its floor here — the two would drift
  // the first time MIN_CHARS_FOR_DERIVATION moved.
  const eligible = rows.filter((r) => shouldDerive(r));
  const edited = eligible.filter((r) => r.date_updated).length;

  console.log(
    `${rows.length} record(s) never derived; ${eligible.length} eligible ` +
      `(enough content to read).`,
  );
  if (edited > 0) {
    console.log(
      `  ${edited} of those have been edited since — those get blanks filled ` +
        `only, not a corrected type or title.`,
    );
  }

  if (!APPLY) {
    for (const r of eligible.slice(0, 20)) {
      console.log(
        `  would derive #${r.id} (${r.recordType}, ${
          r.content?.length ?? 0
        } chars) "${(r.title ?? "").slice(0, 48)}"`,
      );
    }
    if (eligible.length > 20) {
      console.log(`  … and ${eligible.length - 20} more`);
    }
    console.log("\nDry run. Re-run with --apply to spend the LLM calls.");
    return;
  }

  const targets = eligible.slice(0, LIMIT === Infinity ? undefined : LIMIT);
  let changed = 0;
  let noop = 0;
  const touched = new Map<number, number>(); // applicationId → profileId
  for (const r of targets) {
    const applied = await deriveRecordMetadata(r.id, r.profileId);
    const retyped = applied?.record_type
      ? `${r.recordType} → ${applied.record_type}`
      : r.recordType;
    if (applied && Object.keys(applied).length > 0) {
      changed++;
      touched.set(r.applicationId, r.profileId);
    } else noop++;
    console.log(
      `  #${r.id} ${retyped}${
        applied?.title ? ` · "${String(applied.title).slice(0, 48)}"` : ""
      }`,
    );
  }
  console.log(`\nDerived ${changed}, no-op ${noop}, of ${targets.length}.`);

  // Same order as the write path: derive first, then summarise, so the digest
  // sees real types and titles instead of the write-time fallbacks. `title` and
  // `record_type` are both in summaryHash, so this is not cosmetic — leaving it
  // out means the standing summary keeps describing "message" entries named
  // after their attachments. summarizeApplication is hash-gated, so an
  // application whose entries did not actually move is a read and nothing more.
  if (touched.size > 0) {
    console.log(`\nRefreshing ${touched.size} application summary(s):`);
    for (const [applicationId, profileId] of touched) {
      const wrote = await summarizeApplication(applicationId, profileId);
      console.log(`  application #${applicationId} → ${wrote ? "resummarised" : "unchanged"}`);
    }
  }
  if (targets.length < eligible.length) {
    console.log(
      `${eligible.length - targets.length} left — re-run to continue.`,
    );
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
