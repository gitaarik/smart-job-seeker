import { createDirectusClient } from "../src/lib/directus";

async function clearDirectusCache() {
  const client = createDirectusClient();

  console.log("Clearing Directus cache...");

  const response = await client.request({
    method: "POST",
    path: "/utils/cache/clear",
  });

  console.log("Directus cache cleared successfully");
  console.log("Response:", response);
}

clearDirectusCache();
