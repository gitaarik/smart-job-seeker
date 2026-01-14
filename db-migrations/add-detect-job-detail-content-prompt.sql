-- Add prompt for detecting job detail content after clicking a job card
-- This identifies where job details appear (modal, side panel, inline expansion)

INSERT INTO ai_chat_prompts (
  request,
  system_prompt,
  user_prompt,
  format,
  date_created,
  date_updated
) VALUES (
  'detect_job_detail_content',

  -- System Prompt
  'You are analyzing a job search page HTML AFTER a user clicked on a job listing.
Your task is to identify WHERE the job detail content appeared on the page.

Common patterns for job detail display:
1. MODAL/DIALOG: A popup overlay with job details (look for [role="dialog"], .modal, .MuiDialog, .ant-modal)
2. SIDE PANEL: A right-side panel that slides in (look for .jobs-details, .job-view-layout, aside elements)
3. INLINE EXPANSION: Content that expands below the clicked item
4. MAIN CONTENT: Job details replace main content area

Your task:
1. Find the container that holds the DETAILED job information (not the job list cards)
2. Look for elements containing: full job description, requirements, company info, apply button
3. Return a CSS selector that uniquely identifies this job detail container
4. Provide a confidence score (0-100) based on how certain you are

CSS SELECTOR RULES:
- Prefer class selectors (.job-details) over complex paths
- Use attribute selectors when helpful ([role="dialog"], [data-job-id])
- Avoid overly specific selectors that may break
- Test: the selector should match exactly ONE element containing job details

CONFIDENCE SCORING:
- 90-100: Clear modal/dialog with role="dialog" or obvious job detail container
- 70-89: Side panel or main content area with job description visible
- 50-69: Found content that looks like job details but structure unclear
- Below 50: Uncertain, might be wrong container

Return null for selector if you cannot identify the job detail container.',

  -- User Prompt
  'Here is the HTML from a job search page AFTER clicking on a job listing.
Identify the container that shows the job details (description, requirements, apply button, etc.).

HTML:
{{html}}

Return:
1. selector: CSS selector for the job detail container (or null if not found)
2. confidence: Your confidence score 0-100
3. contentType: One of "modal", "panel", "inline", "main", "unknown"',

  -- Format (JSON schema)
  '{
    "type": "object",
    "properties": {
      "selector": {
        "type": ["string", "null"],
        "description": "CSS selector for the job detail container"
      },
      "confidence": {
        "type": "integer",
        "minimum": 0,
        "maximum": 100,
        "description": "Confidence score 0-100"
      },
      "contentType": {
        "type": "string",
        "enum": ["modal", "panel", "inline", "main", "unknown"],
        "description": "Type of container displaying job details"
      }
    },
    "required": ["selector", "confidence", "contentType"]
  }',

  NOW(),
  NOW()
)
ON CONFLICT (request) DO UPDATE SET
  system_prompt = EXCLUDED.system_prompt,
  user_prompt = EXCLUDED.user_prompt,
  format = EXCLUDED.format,
  date_updated = NOW();
