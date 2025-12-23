# Structured Output JSON Schemas

This document contains example JSON schemas for the `format` field in the `ai_chat_prompts` collection. These schemas enable Groq's structured output feature, which ensures the LLM returns JSON that exactly matches the specified schema.

## Overview

The `format` field accepts a JSON Schema object that defines the expected structure of the LLM's response. When a `format` is provided:

1. The LLM uses constrained decoding to guarantee output matches the schema
2. You can remove JSON format instructions from your prompts (saves tokens)
3. JSON parsing is more reliable and less error-prone

## Important Notes

- **Strict mode is enabled** by default in the implementation
- All fields should be marked as `required` for strict mode
- Include `"additionalProperties": false` on all objects
- Supported types: string, number, boolean, integer, object, array, enum

## Example Schemas

### 1. Extract Job Links (`extract_job_links`)

This schema defines an array of job URLs.

```json
{
  "type": "object",
  "properties": {
    "links": {
      "type": "array",
      "items": {
        "type": "string",
        "description": "URL to a job posting page"
      },
      "description": "Array of job posting URLs found in the search results"
    }
  },
  "required": ["links"],
  "additionalProperties": false
}
```

**Note:** The current implementation expects a plain array at the root level. To use this schema, you'll need to update the parsing code in `vacancy-scraper.ts` line 58 to use `response.links` instead of parsing the response as a direct array. Alternatively, use this simpler root-level array schema:

```json
{
  "type": "array",
  "items": {
    "type": "string",
    "description": "URL to a job posting page"
  },
  "description": "Array of job posting URLs"
}
```

### 2. Extract Job Data (`extract_job_data`)

This schema defines the structure for extracted job information.

```json
{
  "type": "object",
  "properties": {
    "title": {
      "type": "string",
      "description": "Job title/position name"
    },
    "job_description": {
      "type": ["string", "null"],
      "description": "Full job description text"
    },
    "company_description": {
      "type": ["string", "null"],
      "description": "Information about the company"
    },
    "job_poster": {
      "type": ["string", "null"],
      "description": "Name of person or entity posting the job"
    },
    "date_posted": {
      "type": ["string", "null"],
      "description": "Date when job was posted (ISO 8601 format)",
      "pattern": "^\\d{4}-\\d{2}-\\d{2}"
    },
    "location": {
      "type": ["string", "null"],
      "description": "Job location (city, region, country)"
    },
    "remote": {
      "type": ["string", "null"],
      "description": "Remote work policy (e.g., 'Remote', 'Hybrid', 'On-site')"
    },
    "experience_level": {
      "type": ["string", "null"],
      "description": "Required experience level (e.g., 'Junior', 'Mid', 'Senior')"
    },
    "job_type": {
      "type": ["string", "null"],
      "description": "Employment type (e.g., 'Full-time', 'Part-time', 'Contract')"
    },
    "salary_range": {
      "type": ["string", "null"],
      "description": "Salary range or compensation information"
    }
  },
  "required": [
    "title",
    "job_description",
    "company_description",
    "job_poster",
    "date_posted",
    "location",
    "remote",
    "experience_level",
    "job_type",
    "salary_range"
  ],
  "additionalProperties": false
}
```

**Note:** This schema uses `["string", "null"]` for nullable fields. For strict mode compatibility, consider using a single type with empty string defaults instead, or set `strict: false` in the code.

### 3. Alternative Job Data Schema (Strict Mode Compatible)

This version uses only non-nullable strings for better strict mode compatibility:

```json
{
  "type": "object",
  "properties": {
    "title": {
      "type": "string",
      "description": "Job title/position name"
    },
    "job_description": {
      "type": "string",
      "description": "Full job description text (empty string if not available)"
    },
    "company_description": {
      "type": "string",
      "description": "Information about the company (empty string if not available)"
    },
    "job_poster": {
      "type": "string",
      "description": "Name of person or entity posting the job (empty string if not available)"
    },
    "date_posted": {
      "type": "string",
      "description": "Date when job was posted in YYYY-MM-DD format (empty string if not available)"
    },
    "location": {
      "type": "string",
      "description": "Job location (empty string if not available)"
    },
    "remote": {
      "type": "string",
      "description": "Remote work policy (empty string if not specified)"
    },
    "experience_level": {
      "type": "string",
      "description": "Required experience level (empty string if not specified)"
    },
    "job_type": {
      "type": "string",
      "description": "Employment type (empty string if not specified)"
    },
    "salary_range": {
      "type": "string",
      "description": "Salary range or compensation (empty string if not available)"
    }
  },
  "required": [
    "title",
    "job_description",
    "company_description",
    "job_poster",
    "date_posted",
    "location",
    "remote",
    "experience_level",
    "job_type",
    "salary_range"
  ],
  "additionalProperties": false
}
```

**Handling Empty Values:** The code in `vacancy-scraper.ts` should be updated to convert empty strings to `null` for database insertion:

```typescript
// Convert empty strings to null
Object.keys(data).forEach(key => {
  if (data[key] === '') {
    data[key] = null;
  }
});
```

## How to Use

1. Open Directus admin panel
2. Navigate to `ai_chat_prompts` collection
3. Edit the prompt you want to add structured output to
4. Copy one of the schemas above into the `format` field
5. Save the prompt

The LLM will now guarantee JSON output matching your schema!

## Benefits

- **More reliable**: Guaranteed schema compliance (no more JSON parsing errors)
- **Token efficient**: Remove "Please return JSON in this format..." from prompts
- **Type safe**: Exact structure you specify
- **Better UX**: Users get consistent, predictable responses

## Limitations

- Requires models that support structured outputs (check Groq documentation)
- Strict mode requires all fields marked as required
- Cannot use with streaming or tool calls
- More complex schemas may impact performance slightly

## References

- [Groq Structured Outputs Documentation](https://console.groq.com/docs/structured-outputs)
- [JSON Schema Specification](https://json-schema.org/)
