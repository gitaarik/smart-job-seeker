import type { Handle } from '@sveltejs/kit';

function getThemeFromRequest(request: Request): string {
  // First check for theme cookie
  const cookies = request.headers.get('cookie');
  if (cookies) {
    const themeCookie = cookies
      .split(';')
      .find(cookie => cookie.trim().startsWith('theme='));
    
    if (themeCookie) {
      const theme = themeCookie.split('=')[1]?.trim();
      if (theme === 'dark' || theme === 'light') {
        return theme;
      }
    }
  }

  // Fallback to Accept header to detect system preference
  const acceptHeader = request.headers.get('sec-ch-prefers-color-scheme');
  if (acceptHeader === 'dark') {
    return 'dark';
  }

  // Default to light theme
  return 'light';
}

export const handle: Handle = async ({ event, resolve }) => {
  const theme = getThemeFromRequest(event.request);
  
  return await resolve(event, {
    transformPageChunk: ({ html }) => {
      return html.replace('class="theme-light"', `class="theme-${theme}"`);
    }
  });
};