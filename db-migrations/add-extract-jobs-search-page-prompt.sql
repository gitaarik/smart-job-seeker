-- Add new prompt for extracting comprehensive job data from search results
-- This replaces the limited extract_job_click_selectors with full data extraction

INSERT INTO ai_chat_prompts (
  request,
  system_prompt,
  user_prompt,
  format,
  date_created,
  date_updated
) VALUES (
  'extract_jobs_from_search_page',

  -- System Prompt
  'You are analyzing a job search results page to extract job information from each listing card.

CRITICAL: You MUST use the EXACT data-extract-clickable-id values from the HTML. DO NOT make up or guess ID numbers.

Your task:
1. Find elements with data-extract-clickable-id attributes (these mark clickable job elements)
2. For EACH job, extract as much information as available from the search results card:
   - clickableId (REQUIRED - use EXACT number from data-extract-clickable-id attribute)
   - title (job position name)
   - company (company/employer name)
   - location (city, region, country, or "Remote")
   - salary_min (minimum salary as number only)
   - salary_max (maximum salary as number only)
   - salary_currency (currency code: USD, EUR, GBP, etc.)
   - salary_period (time period: year, month, hour, day)
   - skills (array of required technologies/skills mentioned)
   - remote (work arrangement: Remote, Hybrid, On-site, or null)
   - date_posted (when job was posted - preserve original format)

IMPORTANT RULES:
- Extract ALL available fields, even if incomplete
- Use null for fields not visible in the search results
- clickableId is REQUIRED - must match exact number from HTML
- Date format: preserve as-is (e.g., "Posted 2 days ago", "2026-01-02", "Jan 2")
- Salary: parse "$120k-$180k per year" into min=120000, max=180000, currency=USD, period=year
- Skills: extract from skill tags, labels, or description snippets
- Return ONLY jobs where you found a valid data-extract-clickable-id',

  -- User Prompt
  'Here is HTML from a job search results page with clickable elements marked with data-extract-clickable-id attributes:

{{html}}

Extract all jobs with their available information. For each job:
1. Find the data-extract-clickable-id value (REQUIRED - use exact number)
2. Look around that element for job information
3. Extract title, company, location, salary, skills, remote type, and date posted if visible
4. Use null for fields not present in the search results

CRITICAL: Use the EXACT numbers from data-extract-clickable-id attributes. Do NOT invent ID numbers.

Example - if you see HTML like this:
<div>
  <h3>Senior Software Engineer</h3>
  <span>Acme Corp</span>
  <span>San Francisco, CA</span>
  <span>$120,000 - $180,000 per year</span>
  <span>Remote</span>
  <span>Posted 2 days ago</span>
  <div>Skills: TypeScript, React, Node.js</div>
  <button data-extract-clickable-id="42">View Job</button>
</div>

Return:
{
  "clickableId": 42,
  "title": "Senior Software Engineer",
  "company": "Acme Corp",
  "location": "San Francisco, CA",
  "salary_min": 120000,
  "salary_max": 180000,
  "salary_currency": "USD",
  "salary_period": "year",
  "skills": ["TypeScript", "React", "Node.js"],
  "remote": "Remote",
  "date_posted": "Posted 2 days ago"
}

If a job has minimal information (e.g., only title and company visible):
{
  "clickableId": 43,
  "title": "Product Manager",
  "company": "Tech Startup",
  "location": null,
  "salary_min": null,
  "salary_max": null,
  "salary_currency": null,
  "salary_period": null,
  "skills": null,
  "remote": null,
  "date_posted": null
}',

  -- JSON Schema (format)
  '{
  "type": "object",
  "properties": {
    "jobs": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "clickableId": {
            "type": "integer",
            "description": "EXACT data-extract-clickable-id from HTML - do not invent"
          },
          "title": {
            "type": ["string", "null"],
            "description": "Job title/position name"
          },
          "company": {
            "type": ["string", "null"],
            "description": "Company or employer name"
          },
          "location": {
            "type": ["string", "null"],
            "description": "Job location (city, region, country)"
          },
          "salary_min": {
            "type": ["number", "null"],
            "description": "Minimum salary as numeric value only"
          },
          "salary_max": {
            "type": ["number", "null"],
            "description": "Maximum salary as numeric value only"
          },
          "salary_currency": {
            "type": ["string", "null"],
            "description": "Currency code (USD, EUR, GBP, etc.)"
          },
          "salary_period": {
            "type": ["string", "null"],
            "description": "Salary period (year, month, hour, day)"
          },
          "skills": {
            "type": ["array", "null"],
            "items": { "type": "string" },
            "description": "Array of skills/technologies/tools mentioned"
          },
          "remote": {
            "type": ["string", "null"],
            "description": "Work arrangement (Remote, Hybrid, On-site)"
          },
          "date_posted": {
            "type": ["string", "null"],
            "description": "Date posted - preserve original format from HTML"
          }
        },
        "required": ["clickableId", "title", "company", "location", "salary_min", "salary_max", "salary_currency", "salary_period", "skills", "remote", "date_posted"],
        "additionalProperties": false
      }
    },
    "pattern": {
      "type": "string",
      "description": "Description of the extraction pattern or strategy used"
    },
    "jobCount": {
      "type": "integer",
      "description": "Total number of jobs extracted"
    }
  },
  "required": ["jobs", "pattern", "jobCount"],
  "additionalProperties": false
}',

  NOW(),
  NOW()
)
ON CONFLICT (request) DO UPDATE SET
  system_prompt = EXCLUDED.system_prompt,
  user_prompt = EXCLUDED.user_prompt,
  format = EXCLUDED.format,
  date_updated = NOW();
