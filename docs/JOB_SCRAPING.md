# Job Scraping System

This document describes the job scraping infrastructure built to automatically extract job listings from various platforms and store them in the database.

## Overview

The job scraping system consists of four main components that work together to scrape, process, and store job listings:

1. **HTML Extraction** - Extract links from search result pages
2. **HTML Stripping** - Clean HTML for efficient LLM processing
3. **LLM Integration** - AI-powered data extraction with structured output
4. **Job Scraping** - Orchestrate the scraping workflow

## Architecture

```
Job Search Page → HTML Extract → Job Links
                                    ↓
Job Posting Page → HTML Strip → LLM Extract → Database
```

### Data Flow

1. **Search Results**: Scrape job search results page
2. **Link Extraction**: Extract individual job posting URLs
3. **Job Fetching**: Fetch each job posting page
4. **HTML Cleaning**: Strip unnecessary HTML elements
5. **AI Extraction**: Use LLM to extract structured job data
6. **Storage**: Upsert job data to database

## Components

### 1. HTML Extraction (`html-extract.ts`)

Extracts links from HTML content using Cheerio.

**Functions:**

```typescript
extractLinks(html: string, pattern?: RegExp): string[]
```

Extracts all links from HTML, optionally filtered by regex pattern.

**Features:**
- Deduplication of URLs
- Optional regex filtering
- Handles malformed HTML gracefully

**Example:**

```typescript
import { extractLinks } from '$lib/server/html-extract';

const html = await fetch('https://jobsite.com/search');
const jobLinks = extractLinks(html, /\/job\//);
// Returns: ['https://jobsite.com/job/123', 'https://jobsite.com/job/456']
```

### 2. HTML Stripping (`html-strip.ts`)

Removes unnecessary HTML elements to minimize token usage for LLM processing.

**Functions:**

```typescript
stripHtmlForLlm(html: string): string
```

Cleans HTML while preserving semantic structure.

**What it removes:**
- Script and style tags
- HTML comments
- Head section
- SVG elements
- Empty elements
- Most attributes (keeps: href, src, alt, title, aria-label)

**What it preserves:**
- Semantic structure (headings, paragraphs, lists)
- Important attributes for context
- Self-closing tags (br, hr, img, input)
- Text content

**Example:**

```typescript
import { stripHtmlForLlm } from '$lib/server/html-strip';

const jobPage = await fetch('https://jobsite.com/job/123');
const cleaned = stripHtmlForLlm(jobPage);
// Returns minimal HTML optimized for LLM analysis
```

### 3. LLM Integration (`llm.ts`)

Generic LLM chat completion interface (currently uses Groq).

**Types:**

```typescript
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ResponseFormat {
  type: 'json_schema';
  json_schema: {
    name: string;
    strict?: boolean;
    schema: Record<string, any>;
  };
}

interface ChatCompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: ResponseFormat;
}
```

**Functions:**

```typescript
async generateChatCompletion(
  messages: ChatMessage[],
  options?: ChatCompletionOptions
): Promise<string>
```

**Features:**
- Provider-agnostic interface (easy to switch from Groq)
- Structured output support via JSON schemas
- Configurable model, temperature, max tokens
- Error handling for missing content

**Example:**

```typescript
import { generateChatCompletion } from '$lib/server/llm';

const response = await generateChatCompletion([
  { role: 'system', content: 'Extract job data from HTML' },
  { role: 'user', content: cleanedHtml }
], {
  temperature: 0.3,
  responseFormat: {
    type: 'json_schema',
    json_schema: {
      name: 'job_data',
      strict: true,
      schema: jobDataSchema
    }
  }
});
```

### 4. Job Scraper (`vacancy-scraper.ts`)

Orchestrates the scraping workflow with database integration.

**Functions:**

```typescript
async extractJobLinks(searchResultsHtml: string): Promise<string[]>
async extractJobData(jobHtml: string, sourceUrl: string): Promise<JobData>
async upsertJob(jobData: JobData, sourceUrl: string, importSource: string): Promise<{ id: number; created: boolean }>
```

**Features:**
- Uses AI prompt templates from database (`ai_chat_prompts`)
- Structured output extraction
- Automatic job deduplication by URL
- Scrape count tracking
- Error handling and logging

**Job Data Structure:**

```typescript
interface JobData {
  title: string;
  job_description: string | null;
  company_description: string | null;
  job_poster: string | null;
  date_posted: Date | null;
  location: string | null;
  remote: string | null;
  experience_level: string | null;
  job_type: string | null;
  salary_range: string | null;
}
```

**Example Workflow:**

```typescript
import { extractJobLinks, extractJobData, upsertJob } from '$lib/server/vacancy-scraper';

// 1. Get search results
const searchHtml = await fetch('https://jobsite.com/search?q=developer');

// 2. Extract job links
const jobLinks = await extractJobLinks(searchHtml);

// 3. Process each job
for (const jobUrl of jobLinks) {
  const jobHtml = await fetch(jobUrl);
  const jobData = await extractJobData(jobHtml, jobUrl);
  const result = await upsertJob(jobData, jobUrl, 'LinkedIn');

  console.log(`Job ${result.id} ${result.created ? 'created' : 'updated'}`);
}
```

## Database Schema

### Jobs Collection

The `jobs` collection (formerly `vacancies`) stores scraped job listings:

**Key Fields:**
- `id` - Primary key
- `title` - Job title
- `job_description` - Job requirements and details
- `company_description` - About the company
- `source_url` - Original job posting URL (unique)
- `import_source` - Platform name (LinkedIn, Indeed, etc.)
- `import_status` - Scraping status (draft, published, error)
- `last_scraped` - Last scrape timestamp
- `scrape_count` - Number of times scraped
- `date_posted` - When job was posted
- `location` - Job location
- `remote` - Remote work options
- `experience_level` - Required experience
- `job_type` - Full-time, part-time, contract, etc.
- `salary_range` - Salary information

### Related Collections

- **job_sites** - Job posting sources (LinkedIn, Indeed, etc.)
- **job_searches** - Search configurations with M2M relation to job sites
- **job_resources** - Additional resources linked to jobs

### AI Prompt Templates

Scraping uses two prompt templates stored in `ai_chat_prompts`:

**1. `extract_job_links`**
- Extracts job posting URLs from search results
- Returns: Array of URLs

**2. `extract_job_data`**
- Extracts structured data from job posting
- Returns: JobData object

Both templates support:
- Variable interpolation (e.g., `{{html}}`)
- Structured output via `format` field (JSON schema)
- System and user prompts

## Usage

### Manual Scraping Script

The `scripts/scrape-job-sites.ts` script provides a command-line interface for testing:

```bash
npm run docker:cli
npx tsx scripts/scrape-job-sites.ts
```

### Automated Scraping

For production use, integrate with Directus Flows or cron jobs:

1. **Create Flow** - Schedule or webhook-triggered
2. **HTTP Request** - Fetch search results
3. **Trigger Operation** - Call scraping flow
4. **Process Jobs** - Extract and store data
5. **Notification** - Alert on completion/errors

## Performance Considerations

### HTML Stripping Benefits

Stripping HTML before LLM processing:
- **Reduces tokens** - 50-80% reduction in token count
- **Improves accuracy** - Less noise in extraction
- **Lowers costs** - Fewer tokens = lower API costs
- **Faster processing** - Less data to process

### Batching

For large-scale scraping:
- Process jobs in batches (10-20 at a time)
- Add delays between requests to avoid rate limiting
- Use concurrent processing with limits

```typescript
// Example batch processing
const batchSize = 10;
for (let i = 0; i < jobLinks.length; i += batchSize) {
  const batch = jobLinks.slice(i, i + batchSize);
  await Promise.all(batch.map(processJob));
  await delay(1000); // Rate limiting
}
```

### Deduplication

The system automatically deduplicates by `source_url`:
- Existing jobs are updated with fresh data
- `scrape_count` tracks refresh frequency
- `last_scraped` timestamp for monitoring

## Error Handling

### Common Errors

**1. Prompt Template Not Found**
```
Error: Prompt template 'extract_job_links' not found
```
**Solution**: Create prompt templates in Directus

**2. Invalid JSON Response**
```
Error: Failed to extract job links: Unexpected token
```
**Solution**: Check LLM response format, adjust prompt template

**3. No Content from LLM**
```
Error: No content returned from LLM
```
**Solution**: Check API key, model availability, request format

### Logging

The scraper includes comprehensive error logging:
- Failed parsing attempts logged with response
- Database errors captured
- Source URL included in error messages

## Testing

Comprehensive test coverage (42 tests across 4 modules):

```bash
npm test
```

**Test Files:**
- `html-extract.test.ts` (7 tests)
- `html-strip.test.ts` (13 tests)
- `llm.test.ts` (9 tests)
- `vacancy-scraper.test.ts` (13 tests)

## Future Enhancements

### Planned Features

1. **Multi-platform Support**
   - LinkedIn scraper
   - Indeed scraper
   - Platform-specific extractors

2. **Smart Matching**
   - Profile-to-job matching
   - Skill-based recommendations
   - Location preferences

3. **Monitoring**
   - Scrape success rate tracking
   - Error rate monitoring
   - Performance metrics

4. **Optimization**
   - Incremental scraping (only new jobs)
   - Smart refresh scheduling
   - Duplicate detection improvements

## Security & Ethics

### Rate Limiting

Always respect website rate limits:
- Add delays between requests
- Monitor response codes
- Implement exponential backoff

### robots.txt

Check and respect robots.txt:
```bash
curl https://example.com/robots.txt
```

### Terms of Service

Review and comply with:
- Platform terms of service
- Data usage policies
- Scraping restrictions

### Data Privacy

- Store only necessary data
- Respect user privacy
- Comply with GDPR/privacy laws
- Provide data deletion capabilities

## Troubleshooting

### Scraping Returns Empty Results

1. Check HTML structure hasn't changed
2. Verify prompt templates are correct
3. Test with updated HTML samples
4. Check LLM response format

### High Error Rate

1. Review error logs for patterns
2. Test prompts with sample data
3. Adjust temperature for more consistent output
4. Validate JSON schema requirements

### Performance Issues

1. Enable HTML stripping (if not already)
2. Reduce batch size
3. Add request delays
4. Consider using faster LLM model
5. Cache search results

## References

- [Cheerio Documentation](https://cheerio.js.org/)
- [Groq API Documentation](https://console.groq.com/docs)
- [JSON Schema](https://json-schema.org/)
- [Structured Output Guide](../docs/structured-output-schemas.md)
