import { getWindowVariable } from '$lib/tools/window';
import { writable } from 'svelte/store';

// Detect system preference
function getPreferredTheme() {
  const sessionStorage = getWindowVariable('sessionStorage');

  if (sessionStorage && sessionStorage.getItem('theme')) {
    return sessionStorage.getItem('theme');
  }

  const matchMedia = getWindowVariable('matchMedia');

  if (matchMedia) {
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  return 'light';
}

export const theme = writable(getPreferredTheme());

theme.subscribe((value) => {
  const document = getWindowVariable('document');

  if (document) {
    document.documentElement.classList.remove('theme-light', 'theme-dark');
    document.documentElement.classList.add(`theme-${value}`);
  }
});

export function switchTheme() {
  theme.update((current) => {
    const next = current === 'light' ? 'dark' : 'light';
    const sessionStorage = getWindowVariable('sessionStorage');

    if (sessionStorage) {
      sessionStorage.setItem('theme', next);
    }

    return next;
  });
}
