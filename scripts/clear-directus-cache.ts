import { makeDirectusRequest } from "../src/lib/server/directus";

async function clearDirectusCache() {
  try {
    console.log("Clearing Directus cache...");

    await makeDirectusRequest("POST", "/utils/cache/clear");

    console.log("Directus cache cleared successfully");
  } catch (error) {
    console.error("Error clearing Directus cache:", error);
    process.exit(1);
  }
}

clearDirectusCache();
