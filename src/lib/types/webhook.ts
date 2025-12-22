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

/**
 * Data structure for application_letter.generate webhook event
 */
export interface ApplicationLetterGenerateData {
  /** Array of application letter IDs to generate */
  letterIds: (string | number)[];
  /** Optional additional context for the AI prompt */
  additionalContext?: string;
}

/**
 * Data structure for application_letter.create_followup webhook event
 */
export interface ApplicationLetterCreateFollowupData {
  /** Application letter ID to create follow-up for */
  letterId: number;
  /** User's follow-up request describing what to refine */
  followup_request: string;
  /** Whether to include original context variables in the prompts */
  include_original_context?: boolean;
}

/**
 * Data structure for application_questions.create_followup webhook event
 */
export interface ApplicationQuestionsCreateFollowupData {
  /** Application question ID to create follow-up for */
  questionId: number;
  /** User's follow-up request describing what to refine */
  followup_request: string;
  /** Whether to include original context variables in the prompts */
  include_original_context?: boolean;
}
