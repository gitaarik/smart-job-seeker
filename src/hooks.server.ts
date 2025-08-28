import type { Handle } from '@sveltejs/kit';
import { verifyJWT } from '$lib/auth';
import { prisma } from '$lib/db';

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
  
  // Handle authentication
  const token = event.cookies.get('token');
  
  if (token) {
    const decoded = verifyJWT(token);
    if (decoded) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true
          }
        });
        
        if (user) {
          event.locals.user = user;
        }
      } catch (error) {
        console.error('Authentication error:', error);
      }
    }
  }
  
  return await resolve(event, {
    transformPageChunk: ({ html }) => {
      return html.replace('class="theme-light"', `class="theme-${theme}"`);
    }
  });
};