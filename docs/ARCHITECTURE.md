# Smart Job Seeker - Architecture Documentation

## Overview

Smart Job Seeker is a SvelteKit application that helps users manage their job
search process. It integrates with Directus CMS for data management and uses LLM
capabilities for generating personalized content.

## Technology Stack

### Frontend

- **SvelteKit 5** - Modern framework with file-based routing
- **Svelte 5** - Component framework with runes ($props, $state, $derived,
  $effect)
- **Tailwind CSS** - Utility-first styling
- **TypeScript** - Strict type checking throughout

### Backend

- **SvelteKit Server** - SSR and API routes
- **Prisma ORM** - Database access layer
- **PostgreSQL** - Primary database
- **Directus CMS** - Headless CMS as source of truth

### External Services

- **Groq API** - LLM completions (with fallback support)
- **OpenAI API** - Alternative LLM provider

## Project Structure

````
smart-job-seeker/
├── src/
│   ├── lib/
│   │   ├── components/        # Reusable UI components
│   │   │   ├── ProfileDisplay/
│   │   │   ├── contact-info/
│   │   │   └── *.svelte
│   │   ├── data/             # Static data and types
│   │   ├── server/           # Server-side code
│   │   │   ├── cache/        # LLM response caching
│   │   │   ├── middleware/   # Rate limiting, etc.
│   │   │   ├── monitoring/   # Error tracking
│   │   │   ├── utils/        # Retry logic, helpers
│   │   │   ├── validation/   # Zod schemas
│   │   │   ├── webhook-handlers/  # Modular webhook handlers
│   │   │   ├── config.ts     # Centralized configuration
│   │   │   ├── llm.ts        # LLM abstraction layer
│   │   │   └── directus.ts   # Directus client
│   │   ├── stores/           # Svelte 5 rune-based stores
│   │   └── tools/            # Shared utilities
│   ├── routes/              # SvelteKit file-based routing
│   │   ├── api/webhook/     # Webhook endpoint
│   │   ├── cv/              # CV page
│   │   ├── portfolio/       # Portfolio page
│   │   │   ├── components/  # Portfolio utilities
│   │   │   └── sections/    # Portfolio sections
│   │   └── resume/          # Resume page
│   └── app.css             # Global styles
├── prisma/
│   └── schema.prisma       # Database schema
├── generated/              # Prisma generated code
├── docs/                   # Documentation
└── tests/                  # Test utilities

## Key Architecture Patterns

### 1. Svelte 5 Modern Patterns

All components use modern Svelte 5 runes:
- `$props()` for component properties
- `$state()` for reactive state
- `$derived()` for computed values
- `$effect()` for side effects

**Example:**
```typescript
interface Props {
  profile: Profile;
  showDetails?: boolean;
}

let { profile, showDetails = false }: Props = $props();
let activeTab = $state('overview');
const fullName = $derived(`${profile.firstName} ${profile.lastName}`);
````

### 2. Webhook Handler Registry

Webhooks are handled through a modular registry system:

```typescript
// src/lib/server/webhook-handlers/index.ts
const handlers = new Map<string, WebhookHandler>([
  ["profile.export", profileExportHandler],
  ["ai_chats.generate_full_prompt", aiChatGeneratePromptHandler],
  // ... more handlers
]);
```

Each handler implements a simple interface:

```typescript
interface WebhookHandler {
  eventType: string;
  handle(data: Record<string, unknown>): Promise<WebhookHandlerResult>;
}
```

### 3. Production Reliability

#### Caching

LLM responses are cached using SHA-256 hashes of prompts:

```typescript
// Check cache first
const cachedResponse = llmCache.get(cacheKey, model);
if (cachedResponse) return cachedResponse;

// Make request and cache result
const response = await makeRequest();
llmCache.set(cacheKey, response, model, TTL);
```

#### Retry Logic

External API calls use exponential backoff with jitter:

```typescript
await withRetry(
  async () => apiCall(),
  {
    maxAttempts: 3,
    initialDelay: 1000,
    shouldRetry: isRetryableError,
  },
);
```

#### Rate Limiting

Token bucket algorithm per client IP:

```typescript
if (!rateLimiter.tryConsume(request)) {
  return createRateLimitResponse();
}
```

#### Error Tracking

Structured logging with context:

```typescript
errorTracker.logError(
  "Operation failed",
  error,
  {
    operation: "webhook",
    metadata: { id, type },
  },
);
```

### 4. Type Safety

#### Prisma Types

Database access is fully typed through Prisma:

```typescript
const profile = await db.profile.findUnique({
  where: { id },
  include: {
    work_experiences: true,
    education: true,
  },
});
```

#### Zod Validation

Request payloads are validated with Zod:

```typescript
const schema = z.object({
  event: z.string(),
  payload: z.record(z.unknown()),
});

const validated = schema.parse(data);
```

## Data Flow

### 1. Webhook Processing

```
Directus Flow
    ↓
POST /api/webhook
    ↓
Rate Limit Check
    ↓
Authentication
    ↓
Payload Validation
    ↓
Handler Registry
    ↓
Specific Handler (e.g., aiChatGeneratePromptHandler)
    ↓
Business Logic (with retry + caching)
    ↓
Database Update (Prisma)
    ↓
Cache Clearing (Directus)
    ↓
Response
```

### 2. Page Rendering

```
User Request
    ↓
SvelteKit Route (+page.server.ts)
    ↓
Load Function (Prisma query)
    ↓
Page Component (+page.svelte)
    ↓
Section Components (portfolio/sections/)
    ↓
Utility Components (portfolio/components/)
    ↓
Rendered HTML
```

## Configuration

All configuration is centralized in `src/lib/server/config.ts`:

```typescript
export const config = {
  // Environment
  nodeEnv: "production",
  isDevelopment: false,

  // Services
  directusUrl: "https://...",
  groqApiKey: "...",

  // Reliability
  rateLimitMaxTokens: 20,
  retryMaxAttempts: 3,
  llmCacheTTL: 3600000, // 1 hour
};
```

Environment variables are loaded from `.env` and validated on startup.

## Testing Strategy

### Unit Tests (Vitest)

- Server functions (`src/lib/server/__tests__/`)
- Webhook handlers (`src/routes/api/webhook/__tests__/`)
- Utilities and helpers

### Test Coverage

- 180 tests total
- Focus on business logic and API endpoints
- Mock external services (Groq, Directus)

## Performance Considerations

### Caching Strategy

- **LLM Responses**: 1 hour TTL, SHA-256 keys
- **Directus Data**: Manual invalidation via webhook
- **Static Assets**: Handled by Vercel CDN

### Database Optimization

- Selective includes to minimize joins
- Indexed fields for common queries
- Connection pooling via Prisma

### Bundle Size

- Code splitting per route
- Tree shaking for unused imports
- Dynamic imports for large dependencies

## Security

### Authentication

- Webhook secret verification
- Environment-based secrets (never committed)

### Rate Limiting

- Per-IP tracking
- Separate limits for different endpoints
- Token bucket algorithm

### Input Validation

- Zod schemas for all inputs
- Type checking at runtime
- SQL injection prevention via Prisma

## Deployment

### Vercel

- Automatic deployments from Git
- Environment variables in Vercel dashboard
- Serverless functions for API routes

### Docker Compose (Development)

- `database`: PostgreSQL
- `admin`: Directus CMS
- `app`: SvelteKit development server

See `DEPLOYMENT.md` for detailed deployment instructions.

## Future Enhancements

### Monitoring

- Sentry integration for error tracking
- Performance monitoring with Web Vitals
- LLM usage analytics

### Testing

- E2E tests with Playwright
- Component visual regression tests
- Integration test suite

### Features

- Multi-language support
- PDF generation server-side
- Real-time collaboration

## Contributing

When contributing to the codebase:

1. Use Svelte 5 runes patterns (no `export let`)
2. Add TypeScript types for all functions
3. Write tests for new features
4. Run `npx deno fmt` before committing
5. Follow existing code organization

See `TESTING.md` for testing guidelines.
