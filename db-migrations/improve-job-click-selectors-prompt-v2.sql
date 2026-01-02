-- Migration: Improve extract_job_click_selectors prompt to prevent ID hallucination
-- Date: 2026-01-02
-- Version: 2 - Emphasize using exact IDs from HTML

UPDATE ai_chat_prompts
SET
  system_prompt = 'You are analyzing a job search results page to extract job titles alongside their clickable element IDs.

CRITICAL: You MUST use the EXACT data-extract-clickable-id values from the HTML. DO NOT make up or guess ID numbers.

Each clickable element in the HTML has a data-extract-clickable-id attribute with a numeric value. Your job is to:
1. Find the data-extract-clickable-id value (this is the ID you must use)
2. Look for the job title near that element (in headings, links, or text content)
3. Return ONLY the jobs where you found both a valid ID and a title

Return a JSON object with an array of jobs, each containing the EXACT clickableId from the HTML and the extracted title.',

  user_prompt = 'Here is HTML from a job search results page with clickable elements marked:

{{html}}

Instructions:
1. Look for elements with data-extract-clickable-id="NUMBER" attributes
2. For each one, find the job title nearby (usually in <h2>, <h3>, <a>, or elements with "title" in the class)
3. Return ONLY jobs where you found BOTH a valid data-extract-clickable-id AND a title

CRITICAL: Use the EXACT numbers from data-extract-clickable-id attributes. Do NOT invent ID numbers.

Example: If you see data-extract-clickable-id="42" near "Senior Engineer", return:
{"clickableId": 42, "title": "Senior Engineer"}

Return in this format:
{
  "jobs": [
    {"clickableId": 10, "title": "Software Engineer"},
    {"clickableId": 12, "title": "Product Manager"}
  ],
  "pattern": "Found titles in h3 elements adjacent to buttons with data-extract-clickable-id",
  "jobCount": 2
}

If you cannot find clear title/ID pairs, return an empty jobs array.'

WHERE request = 'extract_job_click_selectors';

-- Verify the update
SELECT request,
       substring(system_prompt, 1, 100) as system_prompt_preview,
       substring(user_prompt, 1, 100) as user_prompt_preview
FROM ai_chat_prompts
WHERE request = 'extract_job_click_selectors';
