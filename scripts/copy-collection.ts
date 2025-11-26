import { rest } from "@directus/sdk";
import { createDirectusRestClient } from "../src/lib/directus";
import { getEnv } from "../src/lib/tools/get-env";

const sourceCollection = process.argv[2];
const targetCollection = process.argv[3];

// Validate arguments
if (!sourceCollection || !targetCollection) {
  console.error(
    "Usage: npx tsx scripts/copy-collection.ts <sourceCollection> <targetCollection>",
  );
  process.exit(1);
}

if (sourceCollection === targetCollection) {
  console.error(
    "Error: Source and target collection names cannot be the same",
  );
  process.exit(1);
}

async function main() {
  try {
    const adminToken = getEnv("DIRECTUS_ADMIN_TOKEN");

    if (!adminToken) {
      throw new Error("DIRECTUS_ADMIN_TOKEN environment variable is not set");
    }

    const directus = createDirectusRestClient();
    await directus.request(rest.auth.login({ access_token: adminToken }));

    console.log(
      `Copying collection "${sourceCollection}" to "${targetCollection}"...`,
    );

    // Get source collection metadata
    console.log(`Fetching collection metadata for ${sourceCollection}...`);
    const sourceCollectionMeta = await directus.request(
      rest.read("directus_collections", {
        filter: { collection: { _eq: sourceCollection } },
      }),
    );

    if (!sourceCollectionMeta || sourceCollectionMeta.length === 0) {
      throw new Error(`Collection "${sourceCollection}" not found`);
    }

    const collectionData = sourceCollectionMeta[0];

    // Get source field metadata
    console.log(`Fetching field metadata for ${sourceCollection}...`);
    const sourceFields = await directus.request(
      rest.read("directus_fields", {
        filter: { collection: { _eq: sourceCollection } },
        sort: ["sort"],
      }),
    );

    console.log(`Found ${sourceFields.length} fields in ${sourceCollection}`);

    // Create the new collection
    console.log(`Creating collection ${targetCollection}...`);
    await directus.request(
      rest.create("directus_collections", {
        collection: targetCollection,
        icon: collectionData.icon,
        note: collectionData.note,
        display_template: collectionData.display_template,
        hidden: collectionData.hidden,
        singleton: collectionData.singleton,
        translations: collectionData.translations,
        archive_field: collectionData.archive_field,
        archive_app_filter: collectionData.archive_app_filter,
        archive_value: collectionData.archive_value,
        unarchive_value: collectionData.unarchive_value,
        sort_field: collectionData.sort_field,
        accountability: collectionData.accountability,
        color: collectionData.color,
        item_duplication_fields: collectionData.item_duplication_fields,
        sort: collectionData.sort,
        group: collectionData.group,
        collapse: collectionData.collapse,
        preview_url: collectionData.preview_url,
        versioning: collectionData.versioning,
      }),
    );

    console.log(`Collection ${targetCollection} created`);

    // Create fields
    console.log(`Creating fields for ${targetCollection}...`);
    for (const field of sourceFields) {
      await directus.request(
        rest.create("directus_fields", {
          collection: targetCollection,
          field: field.field,
          special: field.special,
          interface: field.interface,
          options: field.options,
          display: field.display,
          display_options: field.display_options,
          readonly: field.readonly,
          hidden: field.hidden,
          sort: field.sort,
          width: field.width,
          translations: field.translations,
          note: field.note,
          conditions: field.conditions,
          required: field.required,
          group: field.group,
          validation: field.validation,
          validation_message: field.validation_message,
          searchable: field.searchable,
        }),
      );
    }

    console.log(`Created ${sourceFields.length} fields`);

    // Copy data
    console.log(
      `Copying data from ${sourceCollection} to ${targetCollection}...`,
    );
    const items = await directus.request(
      rest.read(sourceCollection, {
        limit: -1,
      }),
    );

    if (items && items.length > 0) {
      await directus.request(rest.create(targetCollection, items));
      console.log(`Copied ${items.length} rows`);
    } else {
      console.log("No data to copy");
    }

    console.log(
      `\n✓ Successfully copied collection "${sourceCollection}" to "${targetCollection}"`,
    );
  } catch (error) {
    console.error("Error copying collection:", error);
    process.exit(1);
  }
}

main();
