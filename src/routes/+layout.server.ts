import type { LayoutServerLoad } from './$types';

function getSystemTheme(request: Request): 'light' | 'dark' {
  // Try to detect system preference from headers
  const acceptHeader = request.headers.get('sec-ch-prefers-color-scheme');
  if (acceptHeader === 'dark') {
    return 'dark';
  }
  
  return 'light';
}

function getThemeData(request: Request) {
  // First check for theme preference cookie
  const cookies = request.headers.get('cookie');
  let themePref: 'light' | 'dark' | 'auto' = 'auto'; // Default to auto for new users
  
  if (cookies) {
    const themeCookie = cookies
      .split(';')
      .find(cookie => cookie.trim().startsWith('theme='));
    
    if (themeCookie) {
      const theme = themeCookie.split('=')[1]?.trim();
      if (theme === 'dark' || theme === 'light' || theme === 'auto') {
        themePref = theme as 'light' | 'dark' | 'auto';
      }
    }
  }

  const systemTheme = getSystemTheme(request);
  const actualTheme = themePref === 'auto' ? systemTheme : themePref;
  
  return {
    themePreference: themePref,
    actualTheme,
    systemTheme
  };
}

export const load: LayoutServerLoad = async ({ request }) => {
  const themeData = getThemeData(request);
  
  return {
    themePreference: themeData.themePreference,
    actualTheme: themeData.actualTheme,
    systemTheme: themeData.systemTheme
  };
};