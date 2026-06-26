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

Tests live next to the code they cover — usually in `__tests__` directories,
and sometimes as colocated `*.test.ts` / `*.svelte.test.ts` files:

```
src/
  lib/
    server/
      __tests__/                     # AI chat, HTML processing, LLM, profile export, device/credential
      ai-chat/__tests__/             # prompt interpolation utils
      auth/__tests__/                # API keys, auth guards, token gen/validation
      browser/__tests__/             # geo utilities
      email/__tests__/               # verification parser/relay
      job/__tests__/                 # matching, URL normalization, validation, skill embeddings
      llm/__tests__/                 # embeddings
      profile/__tests__/             # access control, import
      queue/__tests__/               # scraper / rescrape queues
      schemas/__tests__/             # AI prompt schemas
      utils/__tests__/               # slug generator
    import-tasks/readiness.test.ts   # colocated unit test
    salary/conversion.test.ts        # colocated unit test
    monitoring/__tests__/            # Sentry filters
    tools/__tests__/                 # date utilities
  routes/api/
    education/[id]/__tests__/                  # education API
    job-preferences/__tests__/                 # job-preferences API
    platforms/[id]/credentials/__tests__/      # platform credentials API
    interview-stories/__tests__/               # interview-stories API
    profile/[id]/__tests__/                    # profile API
    ...
```

## Test Coverage Areas

The test suite covers (over 580 tests across 45 files):

1. **AI Chat** - Prompt generation, response generation, follow-ups, context
   building, variable interpolation
2. **Authentication** - Token generation/validation, API key auth, auth guards
3. **Job Processing** - Matching, URL normalization, validation, skill embeddings
4. **Profile** - Access control, import, export
5. **Queue** - Scraper queues, rescrape operations
6. **HTML Processing** - Extraction, stripping
7. **Browser** - Geo-utilities
8. **Email** - Verification parsing/relay
9. **LLM** - Chat completion, embeddings
10. **API Endpoints** - Education, job preferences, platforms, interview
    stories, profile

## Mocking Strategy

### Database Mocking

Tests mock the Drizzle client (`$lib/server/db`) using Vitest's `vi.mock()`.
For reads, mock the relational query API (`db.query.<table>.findFirst` /
`findMany`):

```typescript
vi.mock("$lib/server/db", () => ({
  db: {
    query: {
      ai_chats: {
        findFirst: vi.fn(),
      },
      collected_data: {
        findFirst: vi.fn(),
      },
    },
  },
}));
```

For builder-style queries (`select`/`insert`/`update`/`delete`), mock the
fluent chain so each link returns the next and the leaf resolves the rows.
Tests that touch `db/schema` and `drizzle-orm` helpers (e.g. `eq`) usually
mock those too:

```typescript
const mockUpdateWhere = vi.fn().mockResolvedValue({});
const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
const mockUpdateFn = vi.fn().mockReturnValue({ set: mockUpdateSet });

vi.mock("$lib/server/db", () => ({
  db: { update: (...args: any[]) => mockUpdateFn(...args) },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: any, val: any) => val),
}));
```

This allows tests to:

- Control return values for different scenarios
- Test error handling without real database
- Run tests in isolation
- Execute tests quickly

### LLM Mocking

The LLM layer at `src/lib/server/llm/` is a LangChain wrapper. Its public
entry points are `generateChatCompletion` / `generateChatCompletionTracked`
(see `src/lib/server/llm/index.ts`). AI tests mock the underlying LangChain
provider SDK rather than these wrappers, so the real completion/retry/cache
code still runs against a fake model. The provider's `invoke` is hoisted and
returns a LangChain `AIMessage`:

```typescript
const { mockInvoke } = vi.hoisted(() => ({ mockInvoke: vi.fn() }));

vi.mock("@langchain/groq", () => ({
  ChatGroq: class ChatGroq {
    constructor(config: any) {}
    async invoke(messages: any) {
      return mockInvoke(messages);
    }
  },
}));

// in a test:
import { AIMessage } from "@langchain/core/messages";
mockInvoke.mockResolvedValueOnce(new AIMessage("Mocked AI response content"));
```

Alternatively, you can stub a wrapper such as `getInterpolatedPrompts` (from
`$lib/server/ai-chat/utils`) to control the prompts fed into the LLM call.

### Importing Mocked Modules

After mocking, import the actual module to get the mocked version:

```typescript
import { db } from "$lib/server/db";

// db is now the mocked version
const mockDb = db as any;
mockDb.query.profiles.findFirst.mockResolvedValueOnce({ id: 1 });
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
npm run test -- -t "interpolate"          # or --testNamePattern "interpolate"
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
   and `src/lib/server/__tests__/ai-chat-utils.test.ts`
2. **Integration Tests** - Complete AI workflows (generation + database
   updates) in `src/lib/server/__tests__/` (e.g.
   `ai-chat-response-generate.test.ts`, the `ai-chat-*-followup.test.ts` files)

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
import { interpolatePrompt } from "$lib/server/ai-chat/utils";

it("should interpolate profile data into template", () => {
  const template = "Hello ${name}, your email is ${email}";
  const variables = { name: "John", email: "john@example.com" };

  const result = interpolatePrompt(template, variables);

  expect(result).toBe("Hello John, your email is john@example.com");
});
```

**Testing Error Scenarios:**

```typescript
it("should handle LLM rate limit error", async () => {
  (getInterpolatedPrompts as any).mockResolvedValueOnce({
    systemPrompt: "You are helpful",
    userPrompt: "Tell me a joke",
  });
  mockInvoke.mockRejectedValueOnce(
    new Error("Groq API error: Rate limit exceeded"),
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
