import type { Handle } from '@sveltejs/kit';

function getSystemTheme(request: Request): 'light' | 'dark' {
  // Try to detect system preference from headers
  const acceptHeader = request.headers.get('sec-ch-prefers-color-scheme');
  if (acceptHeader === 'dark') {
    return 'dark';
  }
  
  // Check user agent for hints (less reliable)
  const userAgent = request.headers.get('user-agent')?.toLowerCase() || '';
  if (userAgent.includes('dark')) {
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
      .find(cookie => cookie.trim().startsWith('theme='));
    
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
  
  return await resolve(event, {
    transformPageChunk: ({ html }) => {
      return html.replace('class="theme-light"', `class="theme-${theme}"`);
    }
  });
};