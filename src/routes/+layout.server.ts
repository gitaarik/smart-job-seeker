import type { LayoutServerLoad } from "./$types";
import { getEnv } from "$lib/tools/get-env";

function getSystemTheme(request: Request): "light" | "dark" {
  // Try to detect system preference from headers
  const acceptHeader = request.headers.get("sec-ch-prefers-color-scheme");
  if (acceptHeader === "dark") {
    return "dark";
  }

  // Check Accept header for dark mode preference
  const accept = request.headers.get("accept");
  if (accept && accept.includes("dark")) {
    return "dark";
  }

  // Time-based heuristic as fallback
  const now = new Date();
  const hour = now.getHours();

  // If it's between 6 PM and 6 AM, lean towards dark theme
  if (hour >= 18 || hour <= 6) {
    return "dark";
  }

  return "light";
}

function getThemeData(request: Request) {
  // First check for theme preference cookie
  const cookies = request.headers.get("cookie");
  let themePref: "light" | "dark" | "auto" = "auto"; // Default to auto for new users

  if (cookies) {
    const themeCookie = cookies
      .split(";")
      .find((cookie) => cookie.trim().startsWith("theme="));

    if (themeCookie) {
      const theme = themeCookie.split("=")[1]?.trim();
      if (theme === "dark" || theme === "light" || theme === "auto") {
        themePref = theme as "light" | "dark" | "auto";
      }
    }
  }

  const systemTheme = getSystemTheme(request);
  const actualTheme = themePref === "auto" ? systemTheme : themePref;

  return {
    themePreference: themePref,
    actualTheme,
    systemTheme,
  };
}

export const load: LayoutServerLoad = async ({ request, locals }) => {
  const themeData = getThemeData(request);

  return {
    themePreference: themeData.themePreference,
    actualTheme: themeData.actualTheme,
    systemTheme: themeData.systemTheme,
    user: locals.user || null,
  };
};
