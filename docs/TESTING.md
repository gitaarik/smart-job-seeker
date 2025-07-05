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

Tests the POST endpoint for the webhook with signature verification and event handling.

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

## Mocking Strategy

### Database Mocking

The tests mock the Prisma database client using Vitest's `vi.mock()`:

```typescript
vi.mock('$lib/db', () => ({
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
import { db } from '$lib/db';

// db is now the mocked version
const mockDb = db as any;
mockDb.profiles.findUnique.mockResolvedValueOnce({ id: 1 });
```

## Writing New Tests

### Test File Template

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock external dependencies
vi.mock('$lib/path/to/module');

describe('Feature description', () => {
  beforeEach(() => {
    vi.clearAllMocks(); // Reset mocks between tests
  });

  it('should do something specific', async () => {
    // Arrange: Set up test data and mocks
    const mockData = { id: 1, name: 'Test' };

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
3. **Mock external dependencies** - Don't rely on external services or real databases
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
  eventId: 'export-123',
  eventType: 'profile.export',
  timestamp: '2024-11-07T10:30:00.000Z',
  data: { profileId: 1 }
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
  eventType: 'profile.export',
  data: { profileId: 'not-a-number' }
};
// Handler rejects and returns error in response
```

## Profile Export Test Scenarios

### Successful export
```typescript
mockDb.profiles.findUnique.mockResolvedValueOnce({ id: 1 });
mockDb.directus_collections.findUnique.mockResolvedValueOnce({ note: '' });
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
expect(result.message).toContain('not found');
```

### Database error
```typescript
mockDb.profiles.findUnique.mockRejectedValueOnce(
  new Error('Connection failed')
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

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Jest Matchers](https://vitest.dev/api/expect.html)
