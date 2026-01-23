-- Rename data-extract-clickable-id to data-xxx in all prompts
-- This is a token-saving optimization (13 chars vs 27 chars per marker)

-- Update extract_jobs_from_search_page prompt
UPDATE ai_chat_prompts
SET
  system_prompt = REPLACE(system_prompt, 'data-extract-clickable-id', 'data-xxx'),
  user_prompt = REPLACE(user_prompt, 'data-extract-clickable-id', 'data-xxx'),
  format = REPLACE(format::text, 'data-extract-clickable-id', 'data-xxx')::json,
  date_updated = NOW()
WHERE request = 'extract_jobs_from_search_page';

-- Update classify_clickables prompt (if it references the attribute)
UPDATE ai_chat_prompts
SET
  system_prompt = REPLACE(system_prompt, 'data-extract-clickable-id', 'data-xxx'),
  user_prompt = REPLACE(user_prompt, 'data-extract-clickable-id', 'data-xxx'),
  format = REPLACE(format::text, 'data-extract-clickable-id', 'data-xxx')::json,
  date_updated = NOW()
WHERE request = 'classify_clickables';

-- Update any other prompts that might reference this attribute
UPDATE ai_chat_prompts
SET
  system_prompt = REPLACE(system_prompt, 'data-extract-clickable-id', 'data-xxx'),
  user_prompt = REPLACE(user_prompt, 'data-extract-clickable-id', 'data-xxx'),
  format = REPLACE(format::text, 'data-extract-clickable-id', 'data-xxx')::json,
  date_updated = NOW()
WHERE
  system_prompt LIKE '%data-extract-clickable-id%'
  OR user_prompt LIKE '%data-extract-clickable-id%'
  OR format::text LIKE '%data-extract-clickable-id%';
