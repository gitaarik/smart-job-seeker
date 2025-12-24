# Webhook Handlers Documentation

## Overview

The webhook system processes events from Directus Flow scripts. It uses a
modular handler registry pattern that makes it easy to add new event types and
maintain existing handlers.

## Architecture

### Handler Registry (`src/lib/server/webhook-handlers/index.ts`)

The central registry maps event types to their handlers:

```typescript
const handlers = new Map<string, WebhookHandler>([
  ["profile.export", profileExportHandler],
  ["ai_chat.generate_full_prompt", aiChatGeneratePromptHandler],
  ["ai_chat.generate_response", aiChatGenerateResponseHandler],
  [
    "application_interview_question.generate_ai_answer",
    applicationQuestionHandler,
  ],
  ["application_letter.generate", applicationLetterHandler],
  ["application_letter.create_followup", followupLetterHandler],
  ["application_questions.create_followup", followupQuestionHandler],
  ["ai_chat.create_followup", followupChatHandler],
  ["profile_version.generate_preview_links", profileVersionLinksHandler],
]);
```

### Handler Interface

All handlers implement this interface:

```typescript
interface WebhookHandler {
  eventType: string;
  handle(data: Record<string, unknown>): Promise<WebhookHandlerResult>;
}

interface WebhookHandlerResult {
  processed: boolean;
  error?: string;
  message?: string;
  [key: string]: unknown; // Additional result data
}
```

### Middleware

Webhooks pass through middleware layers:

1. **Rate Limiting** (`middleware/rate-limit.ts`)
   - Token bucket algorithm
   - Per-client IP tracking
   - Configurable limits

2. **Authentication** (`middleware/auth.ts`)
   - Secret-based verification
   - Header validation
   - Environment-based secrets

3. **Validation** (`middleware/validation.ts`)
   - Payload structure validation
   - Type checking
   - Error message generation

## Request Flow

```
POST /api/webhook
    ↓
Step 0: Rate Limiting
    ↓
Step 1: Authentication (verifyWebhookAuth)
    ↓
Step 2: Payload Validation (validateWebhookPayload)
    ↓
Step 3: Get Handler (getHandler)
    ↓
Step 4: Execute Handler (handler.handle)
    ↓
Step 5: Clear Directus Cache
    ↓
Return JSON Response
```

## Available Handlers

### 1. Profile Export (`profile.export`)

**File:** `handlers/profile-export.ts`

**Purpose:** Export profiles to JSON Resume format

**Payload:**

```json
{
  "event": "profile.export",
  "keys": [1, 2, 3] // Profile IDs
}
```

**Result:**

```json
{
  "processed": true,
  "profileCount": 3,
  "successCount": 3,
  "results": [...]
}
```

### 2. AI Chat - Generate Prompt (`ai_chat.generate_full_prompt`)

**File:** `handlers/ai-chat-generate-prompt.ts`

**Purpose:** Generate full prompt with context for AI chat

**Payload:**

```json
{
  "event": "ai_chat.generate_full_prompt",
  "payload": {
    "aiChatIds": [1, 2, 3]
  }
}
```

**Result:**

```json
{
  "processed": true,
  "aiChatCount": 3,
  "successCount": 3,
  "results": [...]
}
```

### 3. AI Chat - Generate Response (`ai_chat.generate_response`)

**File:** `handlers/ai-chat-generate-response.ts`

**Purpose:** Generate LLM response for AI chat

**Payload:**

```json
{
  "event": "ai_chat.generate_response",
  "payload": {
    "aiChatIds": [1, 2, 3]
  }
}
```

**Features:**

- LLM response caching (1 hour TTL)
- Retry logic with exponential backoff
- Error tracking and logging

### 4. Application Question - Generate Answer (`application_interview_question.generate_ai_answer`)

**File:** `handlers/application-question.ts`

**Purpose:** Generate AI-powered answers to interview questions

**Payload:**

```json
{
  "event": "application_interview_question.generate_ai_answer",
  "keys": [1, 2, 3] // Question IDs
}
```

### 5. Application Letter - Generate (`application_letter.generate`)

**File:** `handlers/application-letter.ts`

**Purpose:** Generate cover letters for job applications

**Payload:**

```json
{
  "event": "application_letter.generate",
  "keys": [1, 2, 3] // Letter IDs
}
```

### 6. Application Letter - Create Followup (`application_letter.create_followup`)

**File:** `handlers/followup-letter.ts`

**Purpose:** Create follow-up versions of cover letters with refinements

**Payload:**

```json
{
  "event": "application_letter.create_followup",
  "keys": [1], // Parent letter ID
  "payload": {
    "followup_request": "Make it more formal",
    "include_original_context": "true"
  }
}
```

### 7. Application Questions - Create Followup (`application_questions.create_followup`)

**File:** `handlers/followup-question.ts`

**Purpose:** Create follow-up versions of interview answers

**Payload:**

```json
{
  "event": "application_questions.create_followup",
  "keys": [1], // Parent question ID
  "payload": {
    "followup_request": "Add more technical details",
    "include_original_context": "false"
  }
}
```

### 8. AI Chat - Create Followup (`ai_chat.create_followup`)

**File:** `handlers/followup-chat.ts`

**Purpose:** Create follow-up AI chat sessions

**Payload:**

```json
{
  "event": "ai_chat.create_followup",
  "keys": [1], // Parent chat ID
  "payload": {
    "followup_request": "Expand on the first point",
    "include_original_context": "true"
  }
}
```

### 9. Profile Version - Generate Links (`profile_version.generate_preview_links`)

**File:** `handlers/profile-version-links.ts`

**Purpose:** Generate preview links for profile versions

**Payload:**

```json
{
  "event": "profile_version.generate_preview_links",
  "keys": [1, 2, 3] // Version IDs
}
```

## Error Handling

All handlers follow a consistent error handling pattern:

```typescript
try {
  const results = await Promise.allSettled(
    ids.map(async (id) => {
      try {
        await processItem(id);
        return { id, success: true };
      } catch (error) {
        return {
          id,
          success: false,
          message: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),
  );

  const successful = results.filter((r) =>
    r.status === "fulfilled" && r.value.success
  );
  const failed = results.filter((r) =>
    r.status === "rejected" || !r.value.success
  );

  return {
    processed: successful.length > 0,
    successCount: successful.length,
    failureCount: failed.length,
    results: results.map((r) => r.status === "fulfilled" ? r.value : r.reason),
  };
} catch (error) {
  errorTracker.logError("Handler failed", error, { eventType });
  return {
    processed: false,
    error: error instanceof Error ? error.message : "Unknown error",
  };
}
```

### Error Types

- **Validation Errors**: Invalid payload structure (400)
- **Authentication Errors**: Missing or invalid secret (401)
- **Not Found Errors**: Resource doesn't exist (404)
- **Rate Limit Errors**: Too many requests (429)
- **Server Errors**: Internal failures (500)

## Adding a New Handler

1. **Create handler file:**

```typescript
// src/lib/server/webhook-handlers/handlers/my-handler.ts
import type { WebhookHandler, WebhookHandlerResult } from "../types";

export const myHandler: WebhookHandler = {
  eventType: "my.event",

  async handle(data: Record<string, unknown>): Promise<WebhookHandlerResult> {
    // Extract and validate data
    const ids = extractIds(data);

    if (ids.length === 0) {
      return {
        processed: false,
        error: "Missing or invalid IDs",
      };
    }

    try {
      // Process items
      const results = await processItems(ids);

      return {
        processed: true,
        itemCount: ids.length,
        results,
      };
    } catch (error) {
      return {
        processed: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};
```

2. **Register in index.ts:**

```typescript
import { myHandler } from "./handlers/my-handler";

const handlers = new Map<string, WebhookHandler>([
  // ... existing handlers
  ["my.event", myHandler],
]);
```

3. **Add validation schema (optional):**

```typescript
// src/lib/server/validation/schemas.ts
export const myEventSchema = z.object({
  event: z.literal("my.event"),
  payload: z.object({
    itemIds: z.array(z.number()),
  }),
});
```

4. **Add tests:**

```typescript
// src/routes/api/webhook/__tests__/my-handler.test.ts
describe("POST /api/webhook - my.event", () => {
  it("should process valid payload", async () => {
    const response = await POST(createMockEvent({
      event: "my.event",
      payload: { itemIds: [1, 2, 3] },
    }));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });
});
```

## Testing

Webhook handlers are tested at multiple levels:

### Unit Tests

Test individual handler logic in isolation:

```typescript
describe("myHandler", () => {
  it("should process valid data", async () => {
    const result = await myHandler.handle({ itemIds: [1, 2] });
    expect(result.processed).toBe(true);
  });
});
```

### Integration Tests

Test the full webhook flow:

```typescript
describe("POST /api/webhook", () => {
  it("should handle my.event", async () => {
    const response = await POST(createMockEvent({
      event: "my.event",
      payload: { itemIds: [1] },
    }));

    expect(response.status).toBe(200);
  });
});
```

## Security Considerations

### Secret Verification

- Secrets stored in environment variables
- Never logged or exposed in responses
- Constant-time comparison to prevent timing attacks

### Rate Limiting

- Default: 20 requests, refill 0.5 tokens/second
- Per-client IP tracking
- Automatic cleanup of old buckets

### Input Validation

- All payloads validated with Zod
- Type safety enforced at runtime
- SQL injection prevented by Prisma

## Monitoring

All webhook activity is logged:

```typescript
// Success
errorTracker.logInfo("Webhook processed", {
  operation: "webhook",
  metadata: { eventType, duration },
});

// Warning
errorTracker.logWarning("Partial failures", {
  operation: "webhook",
  metadata: { successCount, failureCount },
});

// Error
errorTracker.logError("Webhook failed", error, {
  operation: "webhook",
  metadata: { eventType, path },
});
```

## Best Practices

1. **Batch Processing**: Use `Promise.allSettled()` for multiple items
2. **Idempotency**: Handlers should be safe to retry
3. **Error Context**: Include relevant IDs and metadata
4. **Partial Success**: Report both successes and failures
5. **Logging**: Log at appropriate levels (debug, info, warn, error)
6. **Validation**: Validate inputs before processing
7. **Timeout Handling**: Set appropriate timeouts for long operations
8. **Resource Cleanup**: Clear caches and close connections

## Troubleshooting

### Webhook Not Processing

1. Check secret in Directus Flow matches `DIRECTUS_WEBHOOK_SECRET`
2. Verify payload structure matches handler expectations
3. Check rate limits haven't been exceeded
4. Review error logs for validation failures

### Slow Performance

1. Check LLM cache hit rate
2. Review retry attempts (may indicate API issues)
3. Monitor database query performance
4. Check for N+1 queries in handlers

### Memory Issues

1. Verify cache cleanup is running (every 15 min)
2. Check rate limiter cleanup (every 30 min)
3. Monitor connection pooling
4. Review batch sizes for large operations

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Overall system architecture
- [TESTING.md](./TESTING.md) - Testing guidelines
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment procedures
