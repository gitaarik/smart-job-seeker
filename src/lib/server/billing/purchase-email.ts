/**
 * Purchase confirmation stub — OSS version (sends nothing).
 * Self-hosted has no checkout, so there is no purchase to confirm. The cloud
 * version overlays this with the email that confirms a purchase and the
 * withdrawal waiver given at checkout.
 */

export interface PurchaseConfirmation {
	userId: string;
	item: string;
	waiverVersion: string | null;
	ref: string;
}

export function purchaseConfirmationHtml(
	_item: string,
	_waiver: { version: string; text: string | null } | null,
	_baseUrl: string
): string {
	return '';
}

export async function sendPurchaseConfirmation(_p: PurchaseConfirmation): Promise<void> {}
