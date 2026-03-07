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
  lib/server/
    ai-chat/
      __tests__/                   # AI chat tests
    auth/
      __tests__/                   # Auth tests
    job/
      __tests__/                   # Job matching tests
    profile/
      __tests__/                   # Profile tests
    queue/
      __tests__/                   # Queue tests
    schemas/
      __tests__/                   # Schema tests
    __tests__/                     # General server tests
  routes/api/
    webhook/__tests__/             # Webhook endpoint tests
    education/__tests__/           # Education API tests
    ...
```

## Test Coverage Areas

The test suite covers (~508 tests across 37 files):

1. **AI Chat** - Prompt generation, response generation, follow-ups, context
   building, variable interpolation
2. **Authentication** - Token generation/validation, API key auth, auth guards
3. **Job Processing** - Matching, normalization, validation
4. **Profile** - Access control, import, export
5. **Queue** - Scraper queues, rescrape operations
6. **Webhooks** - Profile export handler, signature verification
7. **HTML Processing** - Extraction, stripping
8. **Browser** - Geo-utilities
9. **API Endpoints** - Education, job preferences, platforms, interview stories

## Mocking Strategy

### Database Mocking

Tests mock the Prisma database client using Vitest's `vi.mock()`:

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

### LLM Mocking

AI tests mock the LangChain integration rather than individual provider SDKs.
The LLM layer at `src/lib/server/llm/` is mocked to return controlled
responses:

```typescript
vi.mock("$lib/server/llm", () => ({
  generateLLMResponse: vi.fn().mockResolvedValue({
    content: "Mocked AI response content",
    usage: {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
    },
  }),
}));
```

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

### Test coverage

```bash
npm run test -- --coverage
```

## AI Feature Testing

AI features use a multi-layered testing approach:

1. **Unit Tests** - Individual utility functions (context building, variable
   interpolation, prompt generation) in `src/lib/server/ai-chat/__tests__/`
2. **Integration Tests** - Complete AI workflows (generation + database updates)
3. **API Tests** - End-to-end API endpoint testing at
   `src/routes/api/ai/__tests__/`

### Running AI Tests Only

```bash
# All AI feature tests
npm run test -- ai-chat

# Specific test categories
npm run test -- ai-chat-utils.test.ts
npm run test -- ai-chat-response-generate.test.ts
```

### AI Test Coverage Areas

- **Context Building** - Profile data extraction, job description parsing,
  template variable interpolation
- **Prompt Generation** - System + user prompt combination, context injection
- **AI Response Generation** - LLM integration (mocked), response storage,
  token tracking, error handling
- **Follow-up System** - Parent-child linking, context inheritance, iterative
  refinement
- **Application Features** - Letter generation (4 types), question answering,
  letter/answer refinement

### Common Test Patterns

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
it("should handle LLM rate limit error", async () => {
  mockLLM.generateLLMResponse.mockRejectedValueOnce(
    new LLMRateLimitError("Rate limit exceeded"),
  );

  const result = await generateAiChatResponse(1);

  expect(result.success).toBe(false);
  expect(result.message).toContain("Rate limit");
});
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

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Vitest API Reference](https://vitest.dev/api/expect.html)
