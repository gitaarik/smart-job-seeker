/**
 * Webhook types for Directus CMS integration
 * Used for secure communication between Directus Flow scripts and SvelteKit
 */

export interface WebhookPayload {
  /** Unique event identifier */
  eventId: string;
  /** Type of event (e.g., 'item.create', 'item.update') */
  eventType: string;
  /** Timestamp when event occurred */
  timestamp: string;
  /** The actual data payload from Directus Flow */
  data: Record<string, unknown>;
  /** Optional metadata about the event */
  metadata?: Record<string, unknown>;
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
  /** Processing timestamp */
  timestamp: string;
}

export interface WebhookError {
  code: string;
  message: string;
  statusCode: number;
}
