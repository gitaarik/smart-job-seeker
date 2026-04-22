import type { PageServerLoad } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { profiles } from "$lib/server/db/schema";

export const load: PageServerLoad = async ({ parent }) => {
  const { profileId } = await parent();

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, profileId),
    columns: {
      email_digest_enabled: true,
      email_digest_frequency_days: true,
      email_digest_min_score: true,
      email_digest_last_sent_at: true,
      email_address: true,
    },
  });

  return {
    emailDigest: {
      enabled: profile?.email_digest_enabled ?? false,
      frequency_days: profile?.email_digest_frequency_days ?? 7,
      min_score: profile?.email_digest_min_score ?? 70,
      last_sent_at: profile?.email_digest_last_sent_at?.toISOString() ?? null,
      email_address: profile?.email_address ?? null,
    },
  };
};
