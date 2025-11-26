import { makeDirectusRequest } from "../src/lib/server/directus";

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
    console.log(
      `Copying collection "${sourceCollection}" to "${targetCollection}"...`,
    );

    // Get source collection metadata
    console.log(`Fetching collection metadata for ${sourceCollection}...`);
    const sourceCollectionResponse = await makeDirectusRequest(
      "GET",
      `/collections/${sourceCollection}`,
    );
    const sourceCollectionMeta = sourceCollectionResponse.data?.meta;

    if (!sourceCollectionMeta) {
      throw new Error(`Collection "${sourceCollection}" not found`);
    }

    const collectionData = sourceCollectionMeta;

    // Verify target collection exists
    console.log(`Verifying target collection "${targetCollection}" exists...`);
    try {
      await makeDirectusRequest("GET", `/collections/${targetCollection}`);
    } catch (error) {
      throw new Error(
        `Target collection "${targetCollection}" does not exist. Please create it in the Directus UI first.`,
      );
    }

    // Get source field metadata
    console.log(`Fetching field metadata for ${sourceCollection}...`);
    const fieldsResponse = await makeDirectusRequest(
      "GET",
      `/fields/${sourceCollection}`,
    );
    const sourceFields = fieldsResponse.data
      .filter(
        (field: { field: string }) =>
          !["id", "sort", "date_created", "date_updated"].includes(
            field.field,
          ),
      )
      .map((field: { meta: unknown }) => field.meta);

    console.log(`Found ${sourceFields.length} fields to copy`);

    // Create fields in target collection
    console.log(`Creating fields for ${targetCollection}...`);
    for (const field of sourceFields) {
      try {
        await makeDirectusRequest("POST", `/fields/${targetCollection}`, {
          field: (field as Record<string, unknown>).field,
          special: (field as Record<string, unknown>).special,
          interface: (field as Record<string, unknown>).interface,
          options: (field as Record<string, unknown>).options,
          display: (field as Record<string, unknown>).display,
          display_options: (field as Record<string, unknown>)
            .display_options,
          readonly: (field as Record<string, unknown>).readonly,
          hidden: (field as Record<string, unknown>).hidden,
          sort: (field as Record<string, unknown>).sort,
          width: (field as Record<string, unknown>).width,
          translations: (field as Record<string, unknown>).translations,
          note: (field as Record<string, unknown>).note,
          conditions: (field as Record<string, unknown>).conditions,
          required: (field as Record<string, unknown>).required,
          group: (field as Record<string, unknown>).group,
          validation: (field as Record<string, unknown>).validation,
          validation_message: (field as Record<string, unknown>)
            .validation_message,
          searchable: (field as Record<string, unknown>).searchable,
        });
      } catch (error) {
        console.warn(
          `Warning: Could not create field ${
            (field as Record<string, unknown>).field
          }: ${error}`,
        );
      }
    }

    console.log(`Created/updated ${sourceFields.length} fields`);

    // Copy data
    console.log(
      `Copying data from ${sourceCollection} to ${targetCollection}...`,
    );
    const itemsResponse = await makeDirectusRequest(
      "GET",
      `/items/${sourceCollection}?limit=-1`,
    );
    const items = itemsResponse.data;

    if (items && items.length > 0) {
      await makeDirectusRequest("POST", `/items/${targetCollection}`, items);
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
