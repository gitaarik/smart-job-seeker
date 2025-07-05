import { getWindowVariable } from '$lib/tools/window';
import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

type ThemePreference = 'light' | 'dark' | 'auto';
type ActualTheme = 'light' | 'dark';

// Track the auto-cycle state
let autoCycleState: 'first' | 'second' | null = null;

// Store for the user's preference (light/dark/auto)
export const themePreference = writable<ThemePreference>('auto');

// Store for the system's current theme
export const systemTheme = writable<ActualTheme>('light');

// Derived store for the actual theme being applied
export const theme = derived(
  [themePreference, systemTheme],
  ([pref, system]) => pref === 'auto' ? system : pref as ActualTheme
);

// Initialize theme from server data
export function initializeTheme(
  serverPreference: ThemePreference,
  serverActualTheme: ActualTheme,
  serverSystemTheme: ActualTheme
) {
  themePreference.set(serverPreference);
  systemTheme.set(serverSystemTheme);
  
  if (browser) {
    // Set up system theme monitoring
    const matchMedia = getWindowVariable('matchMedia');
    if (matchMedia) {
      const mediaQuery = matchMedia('(prefers-color-scheme: dark)');
      
      // Update system theme based on current preference
      systemTheme.set(mediaQuery.matches ? 'dark' : 'light');
      
      // Listen for system theme changes
      const handleChange = (e: MediaQueryListEvent) => {
        systemTheme.set(e.matches ? 'dark' : 'light');
      };
      
      mediaQuery.addEventListener('change', handleChange);
      
      // Cleanup function would be needed in a real component
      // but stores don't have cleanup, so this is a limitation
    }
  }
}

// Client-side initialization for when server data isn't available
function initializeClientTheme() {
  if (!browser) return;

  const document = getWindowVariable('document');
  let preference: ThemePreference = 'auto';

  // Check for stored preference in cookie
  if (document && document.cookie) {
    const themeCookie = document.cookie
      .split(';')
      .find(cookie => cookie.trim().startsWith('theme='));
    
    if (themeCookie) {
      const theme = themeCookie.split('=')[1]?.trim();
      if (theme === 'dark' || theme === 'light' || theme === 'auto') {
        preference = theme as ThemePreference;
      }
    }
  }

  themePreference.set(preference);

  // Set system theme
  const matchMedia = getWindowVariable('matchMedia');
  if (matchMedia) {
    const mediaQuery = matchMedia('(prefers-color-scheme: dark)');
    systemTheme.set(mediaQuery.matches ? 'dark' : 'light');
    
    // Listen for system theme changes
    const handleChange = (e: MediaQueryListEvent) => {
      systemTheme.set(e.matches ? 'dark' : 'light');
    };
    
    mediaQuery.addEventListener('change', handleChange);
  }
}

// Initialize client-side theme if not already initialized by server
if (browser) {
  initializeClientTheme();
}

// Subscribe to theme changes to update DOM and save preference
theme.subscribe((value) => {
  if (!browser) return;

  const document = getWindowVariable('document');
  if (document) {
    // Update the DOM
    document.documentElement.classList.remove('theme-light', 'theme-dark');
    document.documentElement.classList.add(`theme-${value}`);
  }
});

// Subscribe to preference changes to save to cookie
themePreference.subscribe((value) => {
  if (!browser) return;

  const document = getWindowVariable('document');
  if (document) {
    // Save preference to cookie (expires in 1 year)
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    document.cookie = `theme=${value}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
  }
});

export function switchTheme() {
  themePreference.update((current) => {
    // Handle auto-cycle continuation
    if (autoCycleState === 'first') {
      // Second step: go to the other theme
      autoCycleState = 'second';
      return current === 'light' ? 'dark' : 'light';
    } else if (autoCycleState === 'second') {
      // Third step: go back to auto
      autoCycleState = null;
      return 'auto';
    }
    
    // Standard cycle: light -> dark -> auto -> light
    switch (current) {
      case 'light':
        autoCycleState = null;
        return 'dark';
      case 'dark':
        autoCycleState = null;
        return 'auto';
      case 'auto':
        // When on auto, switch to opposite of current actual theme first
        let currentSystemTheme: ActualTheme = 'light';
        systemTheme.subscribe(value => currentSystemTheme = value)();
        
        // Start the auto-cycle: switch to opposite of current actual theme
        autoCycleState = 'first';
        return currentSystemTheme === 'light' ? 'dark' : 'light';
      default:
        autoCycleState = null;
        return 'light';
    }
  });
}
