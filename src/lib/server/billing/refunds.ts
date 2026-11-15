/**
 * Refunds and disputes stub — OSS version.
 * The cloud version overlays this file and takes refunded wallet credits back.
 * OSS takes no payments, so there is nothing to reverse.
 */

import type { PurchaseReversal } from './credits';

interface Reversible {
	payment_intent?: string | { id: string } | null;
}

export function reversedCents(
	_charge: { amount_refunded: number } | null,
	_disputes: { amount: number; status: string }[]
): { refunded: number; disputed: number } {
	return { refunded: 0, disputed: 0 };
}

export function paymentIntentIdOf(object: Reversible): string | undefined {
	const pi = object.payment_intent;
	return typeof pi === 'string' ? pi : pi?.id;
}

export async function syncPaymentReversal(_paymentIntentId: string): Promise<PurchaseReversal> {
	return { status: 'unknown' };
}
