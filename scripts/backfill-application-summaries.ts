/**
 * Generate the standing summary for applications the current summariser has
 * never been over — the ones that have no summary at all, and the ones whose
 * summary was written before the summariser learned to extract what it extracts
 * today.
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
 * The selection deliberately mirrors that gate rather than approximating it.
 * When it was `hash IS NULL` and the gate was a hash over the entries, the two
 * agreed on everything except the case that mattered: a summary written by an
 * older summariser. The write path skipped those because the entries had not
 * changed, this skipped them because they had a hash, and `context_details`
 * shipped to an audience of zero applications as a result.
 *
 *   # from cloud/oss, against whichever DB SJS_DATABASE_URL points at
 *   npx dotenvx run -f ../.env -- npx tsx scripts/backfill-application-summaries.ts
 *   npx dotenvx run -f ../.env -- npx tsx scripts/backfill-application-summaries.ts --apply
 *   … --apply --limit 20        # cap the spend on a first run
 */

import { dbDirect as db } from "$lib/server/db";
import { asc, isNull, not, or, sql } from "drizzle-orm";
import { application_records, applications } from "$lib/server/db/schema";
import {
  CONTRACT_PREFIX,
  summarizeApplication,
} from "$lib/server/ai-chat/application-summary";
import { isFinishedStatus } from "$lib/application-status";
import { MIN_ENTRIES_FOR_SUMMARY } from "$lib/application-records";

const APPLY = process.argv.includes("--apply");
const LIMIT = (() => {
  const i = process.argv.indexOf("--limit");
  const n = i === -1 ? NaN : Number(process.argv[i + 1]);
  return Number.isFinite(n) && n > 0 ? n : Infinity;
})();

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
    .where(or(
      isNull(applications.context_summary_hash),
      not(sql`${applications.context_summary_hash} LIKE ${
        CONTRACT_PREFIX + "%"
      }`),
    ))
    .groupBy(applications.id, applications.profile_id, applications.status)
    .orderBy(asc(applications.id));

  // Finished applications are excluded from the spine, so summarising them
  // would be paying for a line nothing renders.
  const eligible = rows.filter((r) =>
    Number(r.entries) >= MIN_ENTRIES_FOR_SUMMARY && !isFinishedStatus(r.status)
  );

  console.log(
    `${rows.length} application(s) not on the current extraction (${CONTRACT_PREFIX}); ` +
      `${eligible.length} eligible (>= ${MIN_ENTRIES_FOR_SUMMARY} entries, not finished).`,
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
