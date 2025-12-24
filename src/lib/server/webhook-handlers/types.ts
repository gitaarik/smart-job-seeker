/**
 * Webhook handler types and interfaces
 */

/**
 * Standard webhook handler interface
 * All webhook event handlers must implement this interface
 */
export interface WebhookHandler {
  /** The event type this handler processes */
  eventType: string;

  /**
   * Handle the webhook event
   * @param data - The event data payload
   * @returns Result object with processing status and details
   */
  handle(data: Record<string, unknown>): Promise<WebhookHandlerResult>;
}

/**
 * Standard webhook handler result
 */
export interface WebhookHandlerResult {
  /** Whether the event was successfully processed */
  processed: boolean;

  /** Optional success message */
  message?: string;

  /** Optional error message if processing failed */
  error?: string;

  /** Additional result data specific to the handler */
  [key: string]: unknown;
}

/**
 * Webhook middleware function type
 */
export type WebhookMiddleware = (
  event: {
    request: Request;
  },
) => Promise<WebhookMiddlewareResult>;

/**
 * Webhook middleware result
 */
export interface WebhookMiddlewareResult {
  /** Whether middleware validation passed */
  success: boolean;

  /** Error message if validation failed */
  message?: string;

  /** HTTP status code to return if validation failed */
  status?: number;

  /** Additional error details */
  error?: string;
}
