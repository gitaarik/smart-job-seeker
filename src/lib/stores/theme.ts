import { writable } from 'svelte/store';

// Detect system preference
function getPreferredTheme() {
  if (typeof localStorage !== 'undefined' && localStorage.getItem('theme')) {
    return localStorage.getItem('theme');
  }
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

export const theme = writable(getPreferredTheme());

// Persist theme changes to localStorage
if (typeof window !== 'undefined') {
  theme.subscribe((value) => {
    localStorage.setItem('theme', value);
    document.documentElement.classList.remove('theme-light', 'theme-dark');
    document.documentElement.classList.add(`theme-${value}`);
  });
} 