import type { Handle } from "@sveltejs/kit";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { auth } from "$lib/server/auth/better-auth";
import type { User } from "$lib/server/auth/better-auth";
import { config } from "$lib/server/config";

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

  // Check for time-based heuristics (rough estimate)
  // This is a fallback when no other indicators are available
  const now = new Date();
  const hour = now.getHours();

  // If it's between 6 PM and 6 AM, lean towards dark theme
  if (hour >= 18 || hour <= 6) {
    return "dark";
  }

  return "light";
}

function getThemeFromRequest(request: Request): string {
  // First check for theme preference cookie
  const cookies = request.headers.get("cookie");
  let themePref = "auto"; // Default to auto for new users

  if (cookies) {
    const themeCookie = cookies
      .split(";")
      .find((cookie) => cookie.trim().startsWith("theme="));

    if (themeCookie) {
      const theme = themeCookie.split("=")[1]?.trim();
      if (theme === "dark" || theme === "light" || theme === "auto") {
        themePref = theme;
      }
    }
  }

  // If auto, determine actual theme based on system preference
  if (themePref === "auto") {
    return getSystemTheme(request);
  }

  return themePref;
}

export const handle: Handle = async ({ event, resolve }) => {
  // Internal rendering bypass (for server-side PDF generation)
  const internalSecret = event.request.headers.get("x-internal-render-secret");
  const internalUserId = event.request.headers.get("x-internal-user-id");
  if (
    internalSecret && internalUserId &&
    internalSecret === config.internalRenderSecret
  ) {
    event.locals.user = { id: internalUserId } as User;
    event.locals.session = null;
    return await resolve(event);
  }

  // Get session and populate locals FIRST, before svelteKitHandler
  // This ensures event.locals is populated when resolve() is called
  try {
    const session = await auth.api.getSession({
      headers: event.request.headers,
    });
    event.locals.user = session?.user ?? null;
    event.locals.session = session?.session ?? null;
  } catch {
    // Invalid/expired session - clear locals and let the page handle auth
    event.locals.user = null;
    event.locals.session = null;
  }

  // Handle Better Auth routes (e.g., /api/auth/*)
  // In dev mode, Vite's dev server always uses http://localhost:PORT as the
  // request origin, which doesn't match the public baseURL behind a reverse
  // proxy. Bypass better-auth's origin check by calling auth.handler directly.
  if (import.meta.env.DEV) {
    const basePath = auth.options.basePath || "/api/auth";
    if (event.url.pathname.startsWith(basePath)) {
      return auth.handler(event.request);
    }
  }

  try {
    const authResponse = await svelteKitHandler({ event, resolve, auth });
    if (authResponse) {
      return authResponse;
    }
  } catch {
    // Session error (e.g., stale token) - clear session cookie and continue
    event.locals.user = null;
    event.locals.session = null;
  }

  // Apply theme
  const theme = getThemeFromRequest(event.request);

  return await resolve(event, {
    transformPageChunk: ({ html }) => {
      return html.replace('class="theme-light"', `class="theme-${theme}"`);
    },
  });
};
