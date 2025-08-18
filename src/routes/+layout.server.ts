import type { LayoutServerLoad } from './$types';

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

export const load: LayoutServerLoad = async ({ request }) => {
  const serverTheme = getThemeFromRequest(request);
  
  return {
    serverTheme
  };
};