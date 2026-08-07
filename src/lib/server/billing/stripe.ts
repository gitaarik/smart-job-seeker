/**
 * Stripe client stub — billing is not available in the OSS version.
 * The cloud version overlays this file with the real Stripe integration.
 */

export function getStripe(): never {
	throw new Error('Billing is not configured. Stripe is only available in the cloud version.');
}

export function getStripeWebhookSecret(): string {
	return '';
}

export function getStripePublishableKey(): string {
	return '';
}
