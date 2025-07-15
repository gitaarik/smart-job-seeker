import { getWindowVariable } from '$lib/tools/window';
import { writable } from 'svelte/store';

// Detect system preference
function getPreferredTheme() {
  const sessionStorageObj = getWindowVariable('sessionStorage');

  if (sessionStorageObj && sessionStorageObj.getItem('theme')) {
    return sessionStorageObj.getItem('theme');
  }

  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  return 'light';
}

export const theme = writable(getPreferredTheme());

theme.subscribe((value) => {
  const documentObj = getWindowVariable('document');

  if (documentObj) {
    documentObj.documentElement.classList.remove('theme-light', 'theme-dark');
    documentObj.documentElement.classList.add(`theme-${value}`);
  }
});

export function switchTheme() {
  theme.update((current) => {
    const next = current === 'light' ? 'dark' : 'light';
    const sessionStorageObj = getWindowVariable('sessionStorage');
    if (sessionStorageObj) {
      sessionStorageObj.setItem('theme', next);
    }
    return next;
  });
}
