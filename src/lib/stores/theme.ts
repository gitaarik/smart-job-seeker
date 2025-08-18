import { getWindowVariable } from '$lib/tools/window';
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Detect system preference (client-side only)
function getPreferredTheme() {
  if (!browser) {
    return 'light'; // Default for server-side
  }

  // Check for stored preference in cookie first
  const document = getWindowVariable('document');
  if (document && document.cookie) {
    const themeCookie = document.cookie
      .split(';')
      .find(cookie => cookie.trim().startsWith('theme='));
    
    if (themeCookie) {
      const theme = themeCookie.split('=')[1]?.trim();
      if (theme === 'dark' || theme === 'light') {
        return theme;
      }
    }
  }

  // Fallback to system preference
  const matchMedia = getWindowVariable('matchMedia');
  if (matchMedia) {
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  return 'light';
}

export const theme = writable(getPreferredTheme());

theme.subscribe((value) => {
  if (!browser) return;

  const document = getWindowVariable('document');

  if (document) {
    // Update the DOM
    document.documentElement.classList.remove('theme-light', 'theme-dark');
    document.documentElement.classList.add(`theme-${value}`);
    
    // Save to cookie (expires in 1 year)
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    document.cookie = `theme=${value}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
  }
});

export function switchTheme() {
  theme.update((current) => {
    const next = current === 'light' ? 'dark' : 'light';
    return next;
  });
}
