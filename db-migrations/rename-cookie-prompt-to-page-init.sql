-- Rename and update the cookie dismiss prompt to a combined page init prompt
-- that also detects login state

UPDATE ai_chat_prompts
SET
  request = 'browser_use_page_init',
  user_prompt = 'Navigate to {{startUrl}} and:

1. If you see a cookie consent banner, click to accept/dismiss it
2. Assess if this page requires login

After completing, respond with ONLY this JSON (no other text):
{
  "cookies_handled": true or false,
  "login_required": true or false,
  "reason": "brief explanation"
}

login_required should be true if:
- You see a login form (username/password fields)
- You see "Sign in", "Log in", "Please authenticate" messages
- You were redirected to a login/auth page
- The page explicitly asks you to log in to continue

login_required should be false if:
- You can see the actual content (job listings, search results, etc.)
- No login form or authentication prompts are visible'
WHERE request = 'browser_use_dismiss_cookies';
