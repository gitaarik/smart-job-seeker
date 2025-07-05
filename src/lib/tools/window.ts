import { browser } from '$app/environment';

export function getWindowVariable(
  variableName: keyof Window | "umami" | "turnstile",
  defaultValue: string | null = null
) {
  if (browser && typeof window !== 'undefined') {
    return window[variableName] ?? defaultValue;
  }
  return defaultValue;
}
