/**
 * Re-classify `jobs.region` from `jobs.office_location`.
 *
 * `region` is a derived column, written once at import time by
 * `classifyRegion`. When the classifier is corrected, rows already in the
 * table keep whatever it returned back then — so a classifier bug is also a
 * data bug, and needs a backfill to clear.
 *
 * The motivating case: US state codes were matched as plain substrings, so
 * ", ne" matched ", netherlands" and ", de" matched ", denmark". Every Dutch
 * and Danish job with a country-qualified location was filed under `us`.
 *
 * Safe to re-run: it recomputes from `office_location` and only writes rows
 * whose region actually differs. Dry-run by default.
 *
 *   # from cloud/oss, against whichever DB SJS_DATABASE_URL points at
 *   npx dotenvx run -f ../.env -- npx tsx scripts/backfill-job-regions.ts
 *   npx dotenvx run -f ../.env -- npx tsx scripts/backfill-job-regions.ts --apply
 */

import { dbDirect as db } from "$lib/server/db";
import { eq, isNotNull } from "drizzle-orm";
import { jobs } from "$lib/server/db/schema";
import { classifyRegion } from "$lib/data/job-taxonomy";

const APPLY = process.argv.includes("--apply");

async function main() {
  const rows = await db
    .select({
      id: jobs.id,
      office_location: jobs.office_location,
      region: jobs.region,
    })
    .from(jobs)
    .where(isNotNull(jobs.office_location));

  console.log(`Scanning ${rows.length} jobs with an office_location…\n`);

  const changes: { id: number; from: string; to: string; loc: string }[] = [];
  for (const row of rows) {
    const recomputed = classifyRegion(row.office_location) ?? null;
    if (recomputed !== (row.region ?? null)) {
      changes.push({
        id: row.id,
        from: row.region ?? "(null)",
        to: recomputed ?? "(null)",
        loc: row.office_location ?? "",
      });
    }
  }

  if (changes.length === 0) {
    console.log("✅ Every region already matches the current classifier.");
    return;
  }

  const bucket = new Map<string, number>();
  for (const c of changes) {
    const key = `${c.from} -> ${c.to}`;
    bucket.set(key, (bucket.get(key) ?? 0) + 1);
  }

  console.log(`${changes.length} of ${rows.length} rows would change:\n`);
  for (const [key, n] of [...bucket].sort((a, b) => b[1] - a[1])) {
    const sample = changes.find((c) => `${c.from} -> ${c.to}` === key)!;
    console.log(
      `  ${String(n).padStart(5)}  ${key.padEnd(32)} e.g. ${
        sample.loc.slice(0, 60)
      }`,
    );
  }

  if (!APPLY) {
    console.log("\nDry run — re-run with --apply to write these changes.");
    return;
  }

  console.log("\nApplying…");
  let done = 0;
  for (const c of changes) {
    await db
      .update(jobs)
      .set({ region: c.to === "(null)" ? null : c.to })
      .where(eq(jobs.id, c.id));
    done++;
    if (done % 100 === 0) console.log(`  ${done}/${changes.length}`);
  }
  console.log(`✅ Updated ${done} rows.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .then(() => process.exit(0));
