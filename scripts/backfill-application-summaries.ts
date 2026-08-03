/**
 * Generate the standing summary for applications that have never had one.
 *
 * `summarizeApplication` runs at write time — when a record is added, edited or
 * deleted. That keeps the cost bounded and the summary fresh, but it means an
 * application whose entries have not changed since the feature shipped never
 * gets one: the trigger is a write, and there is no write coming. Active
 * applications self-heal within a day or two; dormant ones stay blank forever,
 * and those are exactly the ones the comparison spine most needs a line about
 * ("this has been sitting for six weeks and here is what it was waiting on").
 *
 * Safe to re-run: `summarizeApplication` is hash-gated, so a second pass over
 * an already-summarised application is a DB read and nothing more. Dry-run by
 * default, because each application it does process costs an LLM call.
 *
 *   # from cloud/oss, against whichever DB SJS_DATABASE_URL points at
 *   npx dotenvx run -f ../.env -- npx tsx scripts/backfill-application-summaries.ts
 *   npx dotenvx run -f ../.env -- npx tsx scripts/backfill-application-summaries.ts --apply
 *   … --apply --limit 20        # cap the spend on a first run
 */

import { dbDirect as db } from "$lib/server/db";
import { asc, isNull, sql } from "drizzle-orm";
import { application_records, applications } from "$lib/server/db/schema";
import { summarizeApplication } from "$lib/server/ai-chat/application-summary";
import { isFinishedStatus } from "$lib/application-status";

const APPLY = process.argv.includes("--apply");
const LIMIT = (() => {
  const i = process.argv.indexOf("--limit");
  const n = i === -1 ? NaN : Number(process.argv[i + 1]);
  return Number.isFinite(n) && n > 0 ? n : Infinity;
})();

/** Matches summarizeApplication's own floor — below it there is nothing to condense. */
const MIN_ENTRIES = 2;

async function main() {
  const rows = await db
    .select({
      id: applications.id,
      profileId: applications.profile_id,
      status: applications.status,
      entries: sql<number>`count(${application_records.id})`.as("entries"),
    })
    .from(applications)
    .leftJoin(
      application_records,
      sql`${application_records.application_id} = ${applications.id}
          AND coalesce(btrim(${application_records.content}), '') <> ''`,
    )
    .where(isNull(applications.context_summary_hash))
    .groupBy(applications.id, applications.profile_id, applications.status)
    .orderBy(asc(applications.id));

  // Finished applications are excluded from the spine, so summarising them
  // would be paying for a line nothing renders.
  const eligible = rows.filter((r) =>
    Number(r.entries) >= MIN_ENTRIES && !isFinishedStatus(r.status)
  );

  console.log(
    `${rows.length} application(s) without a summary; ` +
      `${eligible.length} eligible (>= ${MIN_ENTRIES} entries, not finished).`,
  );

  if (!APPLY) {
    for (const r of eligible.slice(0, 20)) {
      console.log(`  would summarise #${r.id} (${r.entries} entries)`);
    }
    if (eligible.length > 20) {
      console.log(`  … and ${eligible.length - 20} more`);
    }
    console.log("\nDry run. Re-run with --apply to spend the LLM calls.");
    return;
  }

  const targets = eligible.slice(0, LIMIT === Infinity ? undefined : LIMIT);
  let done = 0;
  let skipped = 0;
  for (const r of targets) {
    const wrote = await summarizeApplication(r.id, r.profileId);
    if (wrote) done++;
    else skipped++;
    console.log(
      `  #${r.id} (${r.entries} entries) → ${wrote ? "summarised" : "no-op"}`,
    );
  }
  console.log(`\nSummarised ${done}, no-op ${skipped}, of ${targets.length}.`);
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
