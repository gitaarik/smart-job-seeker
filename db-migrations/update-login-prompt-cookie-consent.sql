-- Add cookie consent dismissal to Browser-Use login prompt
-- Browser-Use's visual AI can naturally identify and click accept buttons
--
-- This adds STEP 0 to dismiss cookie consent banners before login

-- First, ensure the record exists (upsert)
INSERT INTO ai_chat_prompts (request, system_prompt, user_prompt, date_created, date_updated)
VALUES (
  'browser_use_login_only',
  '',
  'You are a browser automation assistant. Your task is to log into a website.

STEP 0: If a cookie consent/privacy banner appears:
   - Click "Accept All", "Accept Cookies", "Allow All", "I Agree", or similar button
   - This clears the banner so you can proceed with login
   - If no banner appears, continue to STEP 1

STEP 1: Navigate to {{platformUrl}}

STEP 2: Enter credentials (do this FIRST, before checking for CAPTCHA):
   - Email/Username: {{username}}
   - Password: {{password}}

STEP 3: BEFORE clicking login, check for CAPTCHA/human verification:
   - "Verify you''re human" checkbox
   - "I''m not a robot" checkbox
   - CAPTCHA image/puzzle
   - Cloudflare/Turnstile challenge

   If CAPTCHA IS visible:
   - Report: CAPTCHA_NEEDED: Human verification required before login
   - Do NOT click the login button
   - The user will solve the CAPTCHA manually via VNC

   If NO CAPTCHA visible:
   - Proceed to click the login/sign-in button

AFTER clicking login, check the result:

   a) Verification CODE input (email code, SMS code, 2FA, OTP, authenticator):
      - STOP and report: VERIFICATION_NEEDED: [describe what code is needed]
      - DO NOT enter any code

   b) Another CAPTCHA appeared after login:
      - Report: CAPTCHA_NEEDED: Human verification required after login

   c) Login successful:
      - Navigate to: {{searchUrl}}
      - Report: SUCCESS: Currently at [URL]

CRITICAL:
- Enter credentials FIRST, then check for CAPTCHA
- CAPTCHA_NEEDED = visual challenge visible, user must solve via VNC
- VERIFICATION_NEEDED = code input field visible, user will provide code',
  NOW(),
  NOW()
)
ON CONFLICT (request) DO UPDATE SET
  user_prompt = EXCLUDED.user_prompt,
  date_updated = NOW();

-- Verify the update
SELECT request, substring(user_prompt, 1, 400) as user_prompt_preview
FROM ai_chat_prompts
WHERE request = 'browser_use_login_only';
