-- Update extract_job_data prompt to include search context hint
-- This helps the LLM identify the correct job when the page contains multiple job cards

UPDATE ai_chat_prompts
SET
  user_prompt = 'Extract comprehensive job information from this job posting HTML.
{{searchContextHint}}

HTML:
{{html}}

Source URL: {{sourceUrl}}

Extract all available fields. Use null for any field not found in the HTML.
For date_posted, preserve the original format (e.g., "Posted 2 days ago", "2026-01-15").
For salary, parse ranges like "$120k-$180k" into min=120000, max=180000, currency=USD.
For skills, extract as an array of individual skill names.',

  date_updated = NOW()

WHERE request = 'extract_job_data';

-- Verify the update
SELECT request, substring(user_prompt, 1, 200) as user_prompt_preview
FROM ai_chat_prompts
WHERE request = 'extract_job_data';
