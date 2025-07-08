import { writable } from 'svelte/store';

// Google RECAPTCHA validated
// Wether the user has been validated to be a human through Google RECAPTCHA.
export const gRecaptchaValidated = writable(false);
