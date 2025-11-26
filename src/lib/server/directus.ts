import { authentication, createDirectus, rest } from "@directus/sdk";
import { getEnv } from "$lib/tools/get-env";

// Define your Directus schema here (customize based on your collections)
export interface DirectusSchema {
  // Add your collection types here
  // Example:
  // users: DirectusUser[];
}

function getDirectusUrl(): string {
  const url = getEnv("DIRECTUS_URL");

  if (!url) {
    throw new Error(
      "ADMIN_URL environment variable is not set",
    );
  }

  return url;
}

function getDirectusToken(): string {
  const token = getEnv("DIRECTUS_ADMIN_TOKEN");

  if (!token) {
    throw new Error(
      "DIRECTUS_ADMIN_TOKEN environment variable is not set",
    );
  }

  return token;
}

export function createDirectusRestClient() {
  const directusUrl = getDirectusUrl();
  const token = getDirectusToken();

  return createDirectus<DirectusSchema>(directusUrl)
    .with(rest())
    .with(authentication("json"))
    .setToken(token);
}
