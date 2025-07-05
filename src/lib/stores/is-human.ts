import { writable } from 'svelte/store';

// Wether the user has been validated to be a human through Cloudflare Turnstile
export const isHuman = writable(false);
