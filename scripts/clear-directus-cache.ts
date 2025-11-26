import { getDirectusInternalUrl } from "../src/lib/server/directus";
import { getEnv } from "../src/lib/tools/get-env";

async function clearDirectusCache() {
  try {
    const directusUrl = getDirectusInternalUrl();
    const email = getEnv("ADMIN_EMAIL");
    const password = getEnv("ADMIN_PASSWORD");

    if (!email || !password) {
      throw new Error(
        "ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required",
      );
    }

    console.log("Authenticating with Directus...");

    // Authenticate and get token
    const authResponse = await fetch(`${directusUrl}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!authResponse.ok) {
      throw new Error(
        `Authentication failed: HTTP ${authResponse.status}: ${authResponse.statusText}`,
      );
    }

    const authData = (await authResponse.json()) as {
      data: { access_token: string };
    };
    const token = authData.data.access_token;

    console.log("Clearing Directus cache...");

    const cacheResponse = await fetch(`${directusUrl}/utils/cache/clear`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!cacheResponse.ok) {
      throw new Error(
        `HTTP ${cacheResponse.status}: ${cacheResponse.statusText}`,
      );
    }

    console.log("Directus cache cleared successfully");
    console.log("Response status:", cacheResponse.status);
  } catch (error) {
    console.error("Error clearing Directus cache:", error);
    process.exit(1);
  }
}

clearDirectusCache();
