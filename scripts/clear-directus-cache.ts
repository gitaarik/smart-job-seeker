import { clearDirectusCache } from "../src/lib/server/directus";

async function main() {
  try {
    console.log("Clearing Directus cache...");

    await clearDirectusCache();

    console.log("Directus cache cleared successfully");
  } catch (error) {
    console.error("Error clearing Directus cache:", error);
    process.exit(1);
  }
}

main();
