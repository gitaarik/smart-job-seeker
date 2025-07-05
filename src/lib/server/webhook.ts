import { createHmac } from 'crypto';

/**
 * Webhook utility functions for both server-side webhook generation and verification
 */

/**
 * Generate a webhook signature for a given payload
 * Use this to sign webhook payloads from Directus Flow scripts
 *
 * @param payload - The payload data as an object
 * @param secret - The webhook secret key
 * @returns HMAC-SHA256 hex signature
 */
export function generateWebhookSignature(
  payload: Record<string, unknown>,
  secret: string
): string {
  const payloadString = JSON.stringify(payload);
  return createHmac('sha256', secret).update(payloadString).digest('hex');
}

/**
 * Generate webhook signature from a raw string
 * Useful when you have already serialized the payload
 *
 * @param rawPayload - The raw payload string
 * @param secret - The webhook secret key
 * @returns HMAC-SHA256 hex signature
 */
export function generateWebhookSignatureFromString(rawPayload: string, secret: string): string {
  return createHmac('sha256', secret).update(rawPayload).digest('hex');
}

/**
 * Verify a webhook signature
 * Use this to verify incoming webhook requests
 *
 * @param payload - The payload object
 * @param signature - The signature from the webhook request
 * @param secret - The webhook secret key
 * @returns true if signature is valid, false otherwise
 */
export function verifyWebhookSignature(
  payload: Record<string, unknown>,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = generateWebhookSignature(payload, secret);
  return signature === expectedSignature;
}

/**
 * Verify a webhook signature from raw string
 *
 * @param rawPayload - The raw payload string
 * @param signature - The signature from the webhook request
 * @param secret - The webhook secret key
 * @returns true if signature is valid, false otherwise
 */
export function verifyWebhookSignatureFromString(
  rawPayload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = generateWebhookSignatureFromString(rawPayload, secret);
  return signature === expectedSignature;
}
