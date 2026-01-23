-- Add cookie banner dismiss prompt for Browser-Use
-- This prompt is used to dismiss cookie banners before any login check or scraping

INSERT INTO ai_chat_prompts (request, system_prompt, user_prompt, date_created, date_updated)
VALUES (
  'browser_use_dismiss_cookies',
  '',
  'You are preparing a webpage for automated scraping.

Navigate to {{startUrl}} first, then:

1. If a cookie consent/privacy banner is visible:
   - Click "Accept All", "Accept Cookies", "Allow All", "I Agree", "Got it", "OK", "Continue", or similar
   - If there is a "Manage cookies" button, click it first, then click "Accept all"

2. If any other modal dialog or overlay is blocking the page:
   - Dismiss it by clicking "Close", "X", or clicking outside the modal

3. Wait for the page to stabilize (no more loading spinners or animations)

Do NOT:
- Extract any data
- Click on any job listings
- Navigate to other pages
- Fill in any forms

Report: DONE when the page is ready, or NO_BANNER if no cookie banner was found.',
  NOW(),
  NOW()
)
ON CONFLICT (request) DO UPDATE SET
  user_prompt = EXCLUDED.user_prompt,
  date_updated = NOW();
