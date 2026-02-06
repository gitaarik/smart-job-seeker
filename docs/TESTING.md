# Testing Guide

This project uses **Vitest** for unit and integration testing.

## Setup

Testing dependencies are already installed:

- `vitest` - Fast unit test framework
- `@vitest/ui` - Optional UI for test visualization

## Running Tests

### Run all tests

```bash
npm run test
```

### Run tests in watch mode (re-run on file changes)

```bash
npm run test:watch
```

### Run tests with UI dashboard

```bash
npm run test:ui
```

## Test Structure

Tests are organized in `__tests__` directories alongside the code they test:

```
src/
  routes/api/webhook/
    __tests__/
      profile-export.test.ts    # Webhook handler tests
    +server.ts
  lib/server/
    __tests__/
      profile-export.test.ts    # Utility function tests
    profile-export.ts
```

## Test Files

### 1. Webhook Handler Tests (`src/routes/api/webhook/__tests__/profile-export.test.ts`)

Tests the POST endpoint for the webhook with signature verification and event
handling.

**Coverage:**

- ✓ HMAC-SHA256 signature verification
- ✓ Missing/invalid signature headers
- ✓ JSON payload validation
- ✓ Required field validation (eventId, eventType, data)
- ✓ profile.export event routing
- ✓ profileId validation and type checking
- ✓ Database interaction mocking
- ✓ Error handling and recovery
- ✓ Response format validation

**Test Suites:**

1. **signature verification** - Tests cryptographic validation
2. **payload validation** - Tests request structure validation
3. **profile.export event processing** - Tests event handler logic
4. **response format** - Tests response structure
5. **error handling** - Tests error scenarios

**Example:**

```bash
npm run test -- profile-export.test.ts
```

### 2. Profile Export Utility Tests (`src/lib/server/__tests__/profile-export.test.ts`)

Tests the profile export functions with mocked database calls.

**Coverage:**

- ✓ `exportProfileSchema()` - exports profile schema with field notes
- ✓ `exportProfileData()` - fetches and exports profile data
- ✓ `exportProfile()` - combines both operations
- ✓ Profile existence validation
- ✓ Database create vs update logic
- ✓ Related data fetching (work experience, education, skills, etc.)
- ✓ Error handling for database failures

**Test Suites:**

1. **exportProfileSchema** - Tests schema export functionality
2. **exportProfileData** - Tests data export functionality
3. **exportProfile** - Tests combined export operation

**Example:**

```bash
npm run test -- lib/server/__tests__/profile-export.test.ts
```

### 3. AI Chat Response Generation Tests (`src/lib/server/__tests__/ai-chat-response-generate.test.ts`)

Tests AI response generation using the Groq API with mocked API calls.

**Coverage:**

- ✓ Successful AI response generation
- ✓ Groq API error handling
- ✓ Missing full_prompt validation
- ✓ Invalid AI chat ID handling
- ✓ Database update after response generation
- ✓ API rate limiting scenarios
- ✓ Token counting and metadata storage

**Test Suites:**

1. **generateAiChatResponse** - Tests AI response generation workflow
2. **error handling** - Tests various failure scenarios
3. **API integration** - Tests Groq API interaction (mocked)

**Example:**

```bash
npm run test -- ai-chat-response-generate.test.ts
```

### 4. AI Chat Utilities Tests (`src/lib/server/__tests__/ai-chat-utils.test.ts`)

Tests core utility functions for AI chat functionality including context
building and variable interpolation.

**Coverage:**

- ✓ `interpolateVariables()` - Template variable replacement
- ✓ `buildProfileContext()` - Profile data to context conversion
- ✓ `buildJobDescriptionContext()` - Job description parsing
- ✓ Context combination for AI prompts
- ✓ Edge cases (missing data, null values)
- ✓ Variable syntax validation (`${variable}`)

**Test Suites:**

1. **interpolateVariables** - Tests template variable interpolation
2. **buildProfileContext** - Tests profile context generation
3. **context building** - Tests complete context assembly

**Example:**

```bash
npm run test -- ai-chat-utils.test.ts
```

### 5. AI Chat Followup Creation Tests (`src/lib/server/__tests__/ai-chat-create-followup.test.ts`)

Tests the creation of follow-up AI chats for iterative refinement.

**Coverage:**

- ✓ Follow-up AI chat creation
- ✓ Context inheritance from parent AI chat
- ✓ Optional original context inclusion
- ✓ Variable interpolation in follow-up prompts
- ✓ Linking to parent AI chat
- ✓ Application/letter/question association
- ✓ Error handling for missing parent

**Test Suites:**

1. **createFollowupAiChat** - Tests follow-up creation
2. **context handling** - Tests context inheritance options
3. **linking behavior** - Tests parent-child relationships

**Example:**

```bash
npm run test -- ai-chat-create-followup.test.ts
```

### 6. Application Letter Followup Tests (`src/lib/server/__tests__/ai-chat-application-letter-followup.test.ts`)

Tests follow-up creation specific to application letters.

**Coverage:**

- ✓ Letter-specific follow-up creation
- ✓ All letter types (cover_letter, motivation_letter, follow_up_email,
  thank_you_letter)
- ✓ Context preservation from original generation
- ✓ Follow-up request integration
- ✓ Linking to application and letter
- ✓ Error handling for non-existent letters

**Test Suites:**

1. **createApplicationLetterFollowup** - Tests letter follow-up workflow
2. **letter type handling** - Tests different letter types
3. **context management** - Tests context options

**Example:**

```bash
npm run test -- ai-chat-application-letter-followup.test.ts
```

### 7. Application Question Followup Tests (`src/lib/server/__tests__/ai-chat-application-question-followup.test.ts`)

Tests follow-up creation for application interview questions.

**Coverage:**

- ✓ Question-specific follow-up creation
- ✓ Answer refinement workflow
- ✓ Context preservation and modification
- ✓ Linking to application and question
- ✓ Profile context handling
- ✓ Error handling for missing questions

**Test Suites:**

1. **createApplicationQuestionFollowup** - Tests question follow-up creation
2. **answer refinement** - Tests iterative answer improvement
3. **context handling** - Tests profile and question context

**Example:**

```bash
npm run test -- ai-chat-application-question-followup.test.ts
```

### 8. AI Chat Webhook Tests (`src/routes/api/webhook/__tests__/ai-chat-generate.test.ts`)

Tests webhook handlers for AI chat generation events.

**Coverage:**

- ✓ `ai_chats.generate_full_prompt` event handling
- ✓ `ai_chats.generate_response` event handling
- ✓ Batch processing of multiple AI chats
- ✓ Request validation (aiChatIds format)
- ✓ Response format validation
- ✓ Error aggregation for batch operations
- ✓ Success/failure count tracking

**Test Suites:**

1. **ai_chats.generate_full_prompt** - Tests prompt generation webhook
2. **ai_chats.generate_response** - Tests response generation webhook
3. **batch processing** - Tests parallel AI chat processing

**Example:**

```bash
npm run test -- ai-chat-generate.test.ts
```

### 9. Followup Webhook Tests (`src/routes/api/webhook/__tests__/followup.test.ts`)

Tests webhook handlers for all followup-related events.

**Coverage:**

- ✓ `ai_chats.create_followup` event handling
- ✓ `application_letter.create_followup` event handling
- ✓ `application_questions.create_followup` event handling
- ✓ Request validation (IDs, followup_request, include_original_context)
- ✓ Batch processing for generic follow-ups
- ✓ Single-item processing for specific follow-ups
- ✓ Response format validation

**Test Suites:**

1. **ai_chats.create_followup** - Tests generic AI chat follow-ups
2. **application_letter.create_followup** - Tests letter refinement
3. **application_questions.create_followup** - Tests question refinement
4. **validation** - Tests request validation

**Example:**

```bash
npm run test -- followup.test.ts
```

## Mocking Strategy

### Database Mocking

The tests mock the Prisma database client using Vitest's `vi.mock()`:

```typescript
vi.mock("$lib/db", () => ({
  db: {
    profiles: {
      findUnique: vi.fn(),
    },
    collected_data: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));
```

This allows tests to:

- Control return values for different scenarios
- Test error handling without real database
- Run tests in isolation
- Execute tests quickly

### Importing Mocked Modules

After mocking, import the actual module to get the mocked version:

```typescript
import { db } from "$lib/db";

// db is now the mocked version
const mockDb = db as any;
mockDb.profiles.findUnique.mockResolvedValueOnce({ id: 1 });
```

## Writing New Tests

### Test File Template

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock external dependencies
vi.mock("$lib/path/to/module");

describe("Feature description", () => {
  beforeEach(() => {
    vi.clearAllMocks(); // Reset mocks between tests
  });

  it("should do something specific", async () => {
    // Arrange: Set up test data and mocks
    const mockData = { id: 1, name: "Test" };

    // Act: Call the function being tested
    const result = await functionUnderTest(mockData);

    // Assert: Verify the result
    expect(result.success).toBe(true);
  });
});
```

### Best Practices

1. **Use descriptive test names** - Tests should document behavior
2. **One assertion per test** - Keep tests focused and simple
3. **Mock external dependencies** - Don't rely on external services or real
   databases
4. **Clear arrange-act-assert** - Structure tests in three clear phases
5. **Test edge cases** - Include tests for errors and boundary conditions
6. **Avoid test interdependencies** - Each test should be independent

## Test Coverage

To see test coverage, you can add a coverage reporter:

```bash
npm run test -- --coverage
```

## Debugging Tests

### Run a single test file

```bash
npm run test -- profile-export.test.ts
```

### Run tests matching a pattern

```bash
npm run test -- --grep "signature verification"
```

### Run with detailed output

```bash
npm run test -- --reporter=verbose
```

### Debug in VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Vitest",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "test:watch"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

## Webhook Test Scenarios

### Successful webhook

```typescript
const payload = {
  eventId: "export-123",
  eventType: "profile.export",
  timestamp: "2024-11-07T10:30:00.000Z",
  data: { profileId: 1 },
};

const signature = generateSignature(payload, secret);
// Request with valid signature succeeds
```

### Missing signature

```typescript
// Request without x-webhook-signature header
// Returns 401 Unauthorized
```

### Invalid profileId

```typescript
const payload = {
  eventType: "profile.export",
  data: { profileId: "not-a-number" },
};
// Handler rejects and returns error in response
```

## Profile Export Test Scenarios

### Successful export

```typescript
mockDb.profiles.findUnique.mockResolvedValueOnce({ id: 1 });
mockDb.directus_collections.findUnique.mockResolvedValueOnce({ note: "" });
mockDb.directus_fields.findMany.mockResolvedValueOnce([]);
mockDb.collected_data.findFirst.mockResolvedValueOnce(null);
mockDb.collected_data.create.mockResolvedValueOnce({ id: 1 });

const result = await exportProfile(1);
expect(result.success).toBe(true);
```

### Non-existent profile

```typescript
mockDb.profiles.findUnique.mockResolvedValueOnce(null);

const result = await exportProfileSchema(999);
expect(result.success).toBe(false);
expect(result.message).toContain("not found");
```

### Database error

```typescript
mockDb.profiles.findUnique.mockRejectedValueOnce(
  new Error("Connection failed"),
);

const result = await exportProfileSchema(1);
expect(result.success).toBe(false);
```

## CI/CD Integration

Add to your CI pipeline:

```bash
# Run tests
npm run test

# Check types
npm run check

# Lint code
npm run lint
```

All tests should pass before merging to main branch.

## AI Feature Testing

The AI features use a multi-layered testing approach to ensure reliability
without making actual API calls to Groq.

### Testing Strategy

AI feature tests are organized into three layers:

1. **Unit Tests** - Test individual utility functions (context building,
   variable interpolation, prompt generation)
2. **Integration Tests** - Test complete AI workflows (generation + database
   updates)
3. **Webhook Tests** - Test end-to-end webhook event handling with validation

### Groq API Mocking

All tests mock the Groq API to avoid real API calls:

```typescript
vi.mock("groq-sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: "Mocked AI response content",
              },
            },
          ],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150,
          },
        }),
      },
    },
  })),
}));
```

This approach:

- Eliminates API costs during testing
- Ensures tests run quickly and reliably
- Removes dependency on external services
- Allows testing error scenarios (rate limits, API failures)

### Testing AI Workflows

Complete AI generation workflows are tested end-to-end:

```typescript
// Example: Test application letter generation
it("should generate cover letter with profile context", async () => {
  // Mock database to return letter, application, and profile
  mockDb.application_letters.findUnique.mockResolvedValueOnce({
    id: 1,
    type: "cover_letter",
    application_id: 1,
  });

  mockDb.applications.findUnique.mockResolvedValueOnce({
    id: 1,
    job_description: "Software Engineer at TechCorp",
    profile_id: 1,
  });

  mockDb.profiles.findUnique.mockResolvedValueOnce({
    id: 1,
    name: "John Doe",
    // ... profile data
  });

  // Call the generation function
  const result = await generateApplicationLetter(1);

  // Verify success
  expect(result.success).toBe(true);

  // Verify AI chat was created
  expect(mockDb.ai_chats.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        full_prompt: expect.stringContaining("Software Engineer at TechCorp"),
      }),
    }),
  );

  // Verify Groq API was called
  expect(mockGroq.chat.completions.create).toHaveBeenCalled();
});
```

### Running AI Tests Only

To run only AI-related tests:

```bash
# All AI feature tests
npm run test -- ai-chat

# Specific AI test categories
npm run test -- ai-chat-utils.test.ts
npm run test -- ai-chat-response-generate.test.ts
npm run test -- followup.test.ts
```

### AI Test Coverage Areas

The AI test suite covers:

1. **Context Building**
   - Profile data extraction and formatting
   - Job description parsing
   - Template variable interpolation (`${schema}`, `${data}`,
     `${jobDescription}`)

2. **Prompt Generation**
   - System prompt + user prompt combination
   - Context injection into templates
   - Variable substitution accuracy

3. **AI Response Generation**
   - Groq API integration (mocked)
   - Response storage in database
   - Token usage tracking
   - Error handling (API failures, rate limits)

4. **Follow-up System**
   - Parent-child AI chat linking
   - Context inheritance options
   - Follow-up request integration
   - Iterative refinement workflows

5. **Application-Specific Features**
   - Letter generation (all 4 types)
   - Interview question answering
   - Letter refinement
   - Answer refinement

6. **Webhook Integration**
   - Event validation and routing
   - Batch processing
   - Error aggregation
   - Response format consistency

### Common AI Test Patterns

**Testing Context Interpolation:**

```typescript
it("should interpolate profile data into template", () => {
  const template = "Hello ${name}, your email is ${email}";
  const context = { name: "John", email: "john@example.com" };

  const result = interpolateVariables(template, context);

  expect(result).toBe("Hello John, your email is john@example.com");
});
```

**Testing Error Scenarios:**

```typescript
it("should handle Groq API rate limit error", async () => {
  mockGroq.chat.completions.create.mockRejectedValueOnce(
    new Error("Rate limit exceeded"),
  );

  const result = await generateAiChatResponse(1);

  expect(result.success).toBe(false);
  expect(result.message).toContain("Rate limit");
});
```

**Testing Batch Operations:**

```typescript
it("should process multiple AI chats in parallel", async () => {
  const aiChatIds = [1, 2, 3];

  const result = await handleAiChatGenerateResponse({
    aiChatIds,
  });

  expect(result.successCount).toBe(3);
  expect(result.results).toHaveLength(3);
});
```

### Debugging AI Tests

AI tests may fail due to:

1. **Missing Mocks** - Ensure all external dependencies are mocked
2. **Incorrect Context** - Verify profile/job data structure matches expected
   format
3. **Template Syntax** - Check variable names match exactly (`${data}` not
   `${profile}`)
4. **Database State** - Verify mock return values include all required fields

To debug, add console logs to see intermediate values:

```typescript
it("should debug AI generation", async () => {
  const result = await generateAiChatResponse(1);

  console.log("Full prompt:", mockDb.ai_chats.findUnique.mock.results[0]);
  console.log("AI response:", result);

  expect(result.success).toBe(true);
});
```

All tests should pass before merging to main branch.

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Jest Matchers](https://vitest.dev/api/expect.html)
