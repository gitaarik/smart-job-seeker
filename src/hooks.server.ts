import type { Handle } from '@sveltejs/kit';
import { createDirectusClient } from '$lib/directus';
import { readMe, refresh } from '@directus/sdk';

function getSystemTheme(request: Request): 'light' | 'dark' {
  // Try to detect system preference from headers
  const acceptHeader = request.headers.get('sec-ch-prefers-color-scheme');
  if (acceptHeader === 'dark') {
    return 'dark';
  }

  // Check Accept header for dark mode preference
  const accept = request.headers.get('accept');
  if (accept && accept.includes('dark')) {
    return 'dark';
  }

  // Check for common dark mode indicators in user agent
  const userAgent = request.headers.get('user-agent')?.toLowerCase() || '';

  // Check for time-based heuristics (rough estimate)
  // This is a fallback when no other indicators are available
  const now = new Date();
  const hour = now.getHours();

  // If it's between 6 PM and 6 AM, lean towards dark theme
  if (hour >= 18 || hour <= 6) {
    return 'dark';
  }

  return 'light';
}

function getThemeFromRequest(request: Request): string {
  // First check for theme preference cookie
  const cookies = request.headers.get('cookie');
  let themePref = 'auto'; // Default to auto for new users

  if (cookies) {
    const themeCookie = cookies
      .split(';')
      .find((cookie) => cookie.trim().startsWith('theme='));

    if (themeCookie) {
      const theme = themeCookie.split('=')[1]?.trim();
      if (theme === 'dark' || theme === 'light' || theme === 'auto') {
        themePref = theme;
      }
    }
  }

  // If auto, determine actual theme based on system preference
  if (themePref === 'auto') {
    return getSystemTheme(request);
  }

  return themePref;
}

export const handle: Handle = async ({ event, resolve }) => {
  const theme = getThemeFromRequest(event.request);

  // Handle authentication with Directus
  const accessToken = event.cookies.get('directus_access_token');
  const refreshToken = event.cookies.get('directus_refresh_token');

  if (accessToken) {
    try {
      const client = createDirectusClient();

      // Set the access token for this request
      client.setToken(accessToken);

      // Get current user info
      const user = await client.request(
        readMe({
          fields: ['id', 'email', 'first_name', 'last_name', 'role']
        })
      );

      if (user) {
        event.locals.user = {
          id: user.id,
          email: user.email,
          firstName: user.first_name || null,
          lastName: user.last_name || null,
          role: user.role || 'USER'
        };
      }
    } catch (error: any) {
      console.error('Authentication error:', error);

      // If access token is expired and we have a refresh token, try to refresh
      if (refreshToken && error?.errors?.[0]?.extensions?.code === 'TOKEN_EXPIRED') {
        try {
          const client = createDirectusClient();
          const authResult = await client.request(refresh('json', refreshToken));

          if (authResult.access_token && authResult.refresh_token) {
            // Update cookies with new tokens
            event.cookies.set('directus_access_token', authResult.access_token, {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'strict',
              maxAge: authResult.expires || 60 * 15,
              path: '/'
            });

            event.cookies.set('directus_refresh_token', authResult.refresh_token, {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'strict',
              maxAge: 60 * 60 * 24 * 7,
              path: '/'
            });

            // Try to get user info with new token
            client.setToken(authResult.access_token);
            const user = await client.request(
              readMe({
                fields: ['id', 'email', 'first_name', 'last_name', 'role']
              })
            );

            if (user) {
              event.locals.user = {
                id: user.id,
                email: user.email,
                firstName: user.first_name || null,
                lastName: user.last_name || null,
                role: user.role || 'USER'
              };
            }
          }
        } catch (refreshError) {
          console.error('Token refresh error:', refreshError);
          // Clear invalid tokens
          event.cookies.delete('directus_access_token', { path: '/' });
          event.cookies.delete('directus_refresh_token', { path: '/' });
        }
      } else {
        // Clear invalid tokens
        event.cookies.delete('directus_access_token', { path: '/' });
        event.cookies.delete('directus_refresh_token', { path: '/' });
      }
    }
  }

  return await resolve(event, {
    transformPageChunk: ({ html }) => {
      return html.replace('class="theme-light"', `class="theme-${theme}"`);
    }
  });
};