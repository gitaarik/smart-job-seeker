#!/usr/bin/env node

/**
 * One-time migration script to split location JSON into separate fields
 *
 * Converts existing location JSON objects like:
 * - {"city":"San Francisco","region":"CA","countryCode":"US"} → city, region, country_code fields
 * - {"city":"Málaga","countryCode":"Spain"} → city and country_code fields
 */

import { dbDirect } from "../src/lib/db";

interface LocationData {
  city?: string;
  region?: string;
  countryCode?: string;
}

/**
 * Parse location data (JSON or string) into separate fields
 */
function parseLocation(location: string | null): LocationData {
  if (!location) return {};

  try {
    // Try parsing as JSON first (current format after previous migration)
    const parsed = JSON.parse(location);
    return {
      city: parsed.city,
      region: parsed.region,
      countryCode: parsed.countryCode,
    };
  } catch {
    // If not JSON, treat as legacy comma-separated string
    const parts = location.split(",").map((p) => p.trim());

    if (parts.length === 3) {
      return { city: parts[0], region: parts[1], countryCode: parts[2] };
    } else if (parts.length === 2) {
      return { city: parts[0], countryCode: parts[1] };
    } else if (parts.length === 1) {
      return { city: parts[0] };
    }

    return {};
  }
}

async function main() {
  console.log("🔄 Starting location data migration...\n");

  // Get all profiles with existing location data in old fields
  const profiles = await dbDirect.$queryRaw<
    Array<{
      id: number;
      name: string;
      city: string | null;
      region: string | null;
      country_code: string | null;
    }>
  >`
    SELECT id, name, city, region, country_code
    FROM profiles
    WHERE city IS NOT NULL
       OR region IS NOT NULL
       OR country_code IS NOT NULL
  `;

  console.log(`Found ${profiles.length} profiles with location data\n`);

  if (profiles.length === 0) {
    console.log("✅ No profiles to migrate");
    return;
  }

  // Process each profile
  let successCount = 0;
  let errorCount = 0;

  for (const profile of profiles) {
    try {
      console.log(`  ${profile.id}. ${profile.name}`);
      console.log(
        `     OLD: city="${profile.city || ""}", region="${
          profile.region || ""
        }", country_code="${profile.country_code || ""}"`,
      );
      console.log(
        `     NEW: location_city="${profile.city || ""}", location_region="${
          profile.region || ""
        }", location_country_code="${profile.country_code || ""}"`,
      );

      // Copy from old unprefixed fields to new location_ prefixed fields
      await dbDirect.$executeRaw`
        UPDATE profiles
        SET location_city = ${profile.city},
            location_region = ${profile.region},
            location_country_code = ${profile.country_code}
        WHERE id = ${profile.id}
      `;

      console.log(`     ✅ Migrated\n`);
      successCount++;
    } catch (error) {
      console.error(
        `     ❌ Error: ${
          error instanceof Error ? error.message : String(error)
        }\n`,
      );
      errorCount++;
    }
  }

  console.log("\n📊 Migration Summary:");
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Errors:  ${errorCount}`);
  console.log(`   📝 Total:   ${profiles.length}`);

  if (successCount === profiles.length) {
    console.log(
      "\n✨ Migration complete! Location data has been split into location_city, location_region, and location_country_code fields.\n",
    );
  } else {
    console.log(
      "\n⚠️  Some profiles failed to migrate. Please review errors.\n",
    );
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  })
  .finally(() => {
    dbDirect.$disconnect();
  });
