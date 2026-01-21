# AI Prompt Schema Migration

## Status: COMPLETED

All AI prompt schemas have been migrated from database JSON schemas to
TypeScript Zod schemas.

**Migration Date**: January 8, 2026

## Overview

Previously, AI prompt structured output schemas were stored as JSON in the
database (`ai_chat_prompts.format` field) and converted to Zod at runtime using
a `jsonSchemaToZod()` function. This approach had several limitations:

- Runtime conversion overhead
- Limited type safety
- No IDE autocomplete for schema definitions
- Schema changes required database updates
- Difficult to version control schema changes

Now, all schemas are defined as Zod schemas directly in TypeScript code,
providing better type safety, developer experience, and maintainability.

## Schema Location

All schemas are now defined in:
**`src/lib/server/schemas/ai-prompt-schemas.ts`**

This file contains:

- Individual Zod schema exports for each prompt type
- A centralized registry mapping prompt requests to schemas
- Helper functions for schema lookup
- TypeScript type helpers for output types

## Migrated Schemas

The following prompt requests now use code-defined Zod schemas:

| Prompt Request                 | Purpose                              | Output Type                     |
| ------------------------------ | ------------------------------------ | ------------------------------- |
| `extract_job_links`            | Extract job URLs from search results | `{ urls: string[] }`            |
| `extract_job_data`             | Extract structured job data          | Job data object with ~15 fields |
| `extract_job_data_browser_use` | Browser-Use job extraction           | Same as extract_job_data        |
| `score_job_match`              | Score job-candidate match            | Match score with reasoning      |
| `detect_login_page`            | Detect login pages                   | Boolean + indicators            |
| `detect_pagination`            | Identify pagination mechanisms       | Pagination type + selectors     |
| `extract_resume_data`          | Parse resume text                    | Structured resume data          |

### Prompts Without Structured Output

These prompts return plain text and do NOT have schemas:

- `write_cover_letter`
- `write_motivation_letter`
- `write_follow_up_email`
- `write_thank_you_letter`
- `answer_application_question`
- `followup`

## Database Field Status

The `ai_chat_prompts.format` field is **deprecated** and no longer used by the
application.

### What Changed

**Before:**

```typescript
// Schema stored in database
const responseFormat = promptTemplate.format
  ? {
    type: "json_schema" as const,
    json_schema: {
      name: promptRequest.replace(/[^a-zA-Z0-9_]/g, "_"),
      strict: false,
      schema: promptTemplate.format, // JSON from database
    },
  }
  : undefined;
```

**After:**

```typescript
// Schema looked up from code
const zodSchema = getSchemaForPrompt(promptRequest);
const structuredOutput = zodSchema
  ? {
    name: promptRequest.replace(/[^a-zA-Z0-9_]/g, "_"),
    schema: zodSchema, // Zod schema from code
  }
  : undefined;
```

## Code Changes Summary

### Files Modified

1. **`src/lib/server/schemas/ai-prompt-schemas.ts`** (NEW)
   - Created schema registry with all Zod schemas

2. **`src/lib/server/llm-langchain.ts`**
   - Added `StructuredOutputConfig` interface
   - Removed `jsonSchemaToZod()` function (~65 lines)
   - Updated to accept Zod schemas directly
   - Deprecated `ResponseFormat` interface

3. **`src/lib/server/ai-chat-utils.ts`**
   - Changed to look up schemas from code registry
   - No longer reads `format` field from database

4. **`src/lib/server/__tests__/llm.test.ts`**
   - Updated tests to use `StructuredOutputConfig`
   - Tests now use Zod schemas

5. **`src/lib/server/schemas/__tests__/ai-prompt-schemas.test.ts`** (NEW)
   - Comprehensive tests for schema validation

### Files Unchanged

These files continue to work without modification:

- `src/lib/server/scrapers/extraction.ts`
- `src/lib/server/job-matcher.ts`
- `src/lib/server/ai-chat-application-letter.ts`
- `src/lib/server/ai-chat-application-question.ts`
- `src/lib/server/browser-use-client.ts`

All existing functionality continues to work because they call through
`createAndGenerateAiChat()` which handles the schema lookup internally.

## Adding New Schemas

To add a new prompt with structured output:

### 1. Define the Zod Schema

Edit `src/lib/server/schemas/ai-prompt-schemas.ts`:

```typescript
export const myNewPromptSchema = z.object({
  field1: z.string().describe("Description of field1"),
  field2: z.number().min(0).max(100),
  field3: z.array(z.string()).optional(),
});
```

### 2. Add to Registry

```typescript
export const aiPromptSchemas = {
  // ... existing schemas
  my_new_prompt: myNewPromptSchema,
} as const;
```

### 3. Create Prompt in Database

The prompt still needs to exist in `ai_chat_prompts` table with:

- `request`: The prompt identifier (e.g., "my_new_prompt")
- `system_prompt`: System instructions
- `user_prompt`: User prompt template
- `format`: Leave as `null` (no longer used)

### 4. Deploy

Schema changes deploy with your code. No database migration required.

## Type Safety Benefits

### Before (JSON Schema)

```typescript
// No type checking on response
const result = await createJobScrapingAiChat(
  "extract_job_links",
  { html: strippedHtml },
);
// result.response is typed as 'any'
```

### After (Zod)

```typescript
import type { AiPromptSchemaOutput } from "./schemas/ai-prompt-schemas";

type JobLinksResponse = AiPromptSchemaOutput<"extract_job_links">;
// ^ Type is inferred as: { urls: string[] }

const result = await createJobScrapingAiChat<JobLinksResponse>(
  "extract_job_links",
  { html: strippedHtml },
);
// result.response is typed correctly!
```

## Performance Impact

**Positive**: Removed runtime JSON Schema → Zod conversion on every LLM call
with structured output.

**Test Results**: All 352 tests pass, including integration tests for each
prompt type.

## Rollback Plan

If issues arise:

1. **Code Rollback**: Revert the commits that introduced these changes
2. **Database**: No changes needed (format field still exists with historical
   data)
3. **Restore Functionality**: Previous architecture immediately functional

The database `format` field was intentionally kept to enable safe rollback.

## Future Cleanup (Optional)

After 3-6 months of stable operation, consider:

1. Remove `format` column from `ai_chat_prompts` table
2. Update Prisma schema to drop the column
3. Run migration: `ALTER TABLE ai_chat_prompts DROP COLUMN format;`

This is optional and not urgent - keeping the field has minimal cost.

## Benefits Summary

### Developer Experience

✅ Schemas visible in IDE with autocomplete ✅ Type-safe response parsing ✅
Better error messages from Zod validation ✅ Schema changes tracked in Git
history ✅ Schema changes visible in PR reviews

### Code Quality

✅ Removed 65 lines of conversion logic ✅ Eliminated runtime conversion
overhead ✅ More maintainable architecture ✅ Better separation of concerns

### Operations

✅ Schema changes deploy with code ✅ No database sync required for schema
changes ✅ Version control for schema evolution ✅ Easier to test schema changes

## Questions?

For questions about this migration or how to work with AI prompt schemas:

1. Review the schema definitions in
   `src/lib/server/schemas/ai-prompt-schemas.ts`
2. Check the tests in
   `src/lib/server/schemas/__tests__/ai-prompt-schemas.test.ts`
3. See usage examples in `src/lib/server/scrapers/extraction.ts` and
   `src/lib/server/job-matcher.ts`
