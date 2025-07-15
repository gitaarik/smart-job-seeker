import { browser } from '$app/environment';

export function getWindowVariable(variableName: string, defaultValue = null) {
  if (browser && typeof window !== 'undefined') {
    return window[variableName] ?? defaultValue;
  }
  return defaultValue;
}
