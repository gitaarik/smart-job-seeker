import { dbDirect as db } from "$lib/server/db";
import { fx_rates } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import type { FxRates } from "$lib/salary/conversion";

/**
 * Load the latest currency exchange rates from the DB.
 *
 * The `fx_rates` singleton row is the single source of truth, kept fresh by the
 * worker's FX refresh job. When no row exists yet (e.g. a brand-new dev DB before
 * the worker's first successful fetch), this returns an empty map — salary
 * comparisons then degrade cross-currency results to "unknown" instead of
 * guessing. Same-currency comparisons still work without any rates.
 */
export async function getFxRates(): Promise<FxRates> {
  const row = await db.query.fx_rates.findFirst({
    where: eq(fx_rates.id, 1),
  });
  return (row?.rates as FxRates | undefined) ?? {};
}
