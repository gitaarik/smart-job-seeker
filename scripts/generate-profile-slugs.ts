#!/usr/bin/env node

import { dbDirect } from "$lib/server/db";
import { generateUniqueSlug } from "$lib/server/utils/slug-generator";

async function generateSlugsForExistingProfiles() {
  console.log("🔄 Generating slugs for profiles without slugs...\n");

  const profiles = await dbDirect.profiles.findMany({
    where: { slug: null },
    select: { id: true, name: true },
    orderBy: { id: "asc" },
  });

  if (profiles.length === 0) {
    console.log("✅ All profiles already have slugs");
    return;
  }

  console.log(`Found ${profiles.length} profiles without slugs\n`);

  for (const profile of profiles) {
    const slug = await generateUniqueSlug(profile.name, profile.id);

    await dbDirect.profiles.update({
      where: { id: profile.id },
      data: { slug },
    });

    console.log(
      `✅ Profile ${profile.id}: "${profile.name || "Unnamed"}" → ${slug}`,
    );
  }

  console.log(`\n🎉 Generated ${profiles.length} slugs successfully`);
}

generateSlugsForExistingProfiles()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .then(() => process.exit(0));
