/**
 * Webhook types for Directus CMS integration
 * Used for secure communication between Directus Flow scripts and SvelteKit
 */

export interface WebhookPayload {
  /** Type of event (e.g., 'item.create', 'item.update', 'profile.export') */
  eventType: string;
  /** The actual data payload from Directus Flow */
  data: Record<string, unknown>;
  [key: string]: unknown;
}

export interface WebhookResponse<T = unknown> {
  /** Success status */
  success: boolean;
  /** Response message */
  message: string;
  /** Response data */
  data?: T;
  /** Error details if applicable */
  error?: string;
}

export interface WebhookError {
  code: string;
  message: string;
  statusCode: number;
}
