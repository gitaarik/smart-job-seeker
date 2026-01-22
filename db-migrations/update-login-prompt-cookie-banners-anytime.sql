-- Update Browser-Use login prompts to handle cookie banners at ANY point
-- Cookie banners can appear shortly after page load, not just at the start
-- They should be dismissed automatically, NOT reported as CAPTCHA/verification
--
-- Updates both:
-- - browser_use_login_report_captcha (used when solve_captcha=false)
-- - browser_use_login_solve_captcha (used when solve_captcha=true)

-- Update the "report captcha" prompt (most commonly used)
UPDATE ai_chat_prompts
SET user_prompt = 'You are a browser automation assistant. Your task is to log into a website.

IMPORTANT - COOKIE BANNERS:
If a cookie consent/privacy banner appears AT ANY POINT during this process:
- Immediately dismiss it by clicking: "Accept All", "Accept Cookies", "Allow All", "I Agree", "Got it", "OK", "Continue", "Agree & Close", or similar
- If there''s a "Manage cookies" or "Cookie settings" button, click it first, then click "Accept all" or "Save"
- Cookie banners are NOT CAPTCHA or verification challenges - just dismiss them and continue
- After dismissing, resume whatever step you were on

STEP 1: Navigate to {{platformUrl}}

STEP 2: Enter credentials (do this FIRST, before checking for CAPTCHA):
   - Email/Username: {{username}}
   - Password: {{password}}

STEP 3: Check for "Remember me" checkbox and check it if present

STEP 4: BEFORE clicking login, check for CAPTCHA/human verification:
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

STEP 5: AFTER clicking login, check the result:

   a) Verification CODE input (email code, SMS code, 2FA, OTP, authenticator):
      - STOP and report: VERIFICATION_NEEDED: [describe what code is needed]
      - DO NOT enter any code

   b) Another CAPTCHA appeared after login:
      - Report: CAPTCHA_NEEDED: Human verification required after login

   c) Login successful:
      - Navigate to: {{searchUrl}}
      - Report: SUCCESS: Currently at [URL]

CRITICAL REMINDERS:
- Cookie banners = dismiss immediately, NOT a CAPTCHA
- CAPTCHA_NEEDED = visual puzzle/challenge visible, user must solve via VNC
- VERIFICATION_NEEDED = code input field visible, user will provide code
- Enter credentials FIRST, then check for CAPTCHA',
  date_updated = NOW()
WHERE request = 'browser_use_login_report_captcha';

-- Update the "solve captcha" prompt (used when solve_captcha=true)
UPDATE ai_chat_prompts
SET user_prompt = 'You are a browser automation assistant. Your task is to log into a website.

IMPORTANT - COOKIE BANNERS:
If a cookie consent/privacy banner appears AT ANY POINT during this process:
- Immediately dismiss it by clicking: "Accept All", "Accept Cookies", "Allow All", "I Agree", "Got it", "OK", "Continue", "Agree & Close", or similar
- If there''s a "Manage cookies" or "Cookie settings" button, click it first, then click "Accept all" or "Save"
- Cookie banners are NOT CAPTCHA or verification challenges - just dismiss them and continue
- After dismissing, resume whatever step you were on

STEP 1: Navigate to {{platformUrl}}

STEP 2: Enter credentials (do this FIRST, before checking for CAPTCHA):
   - Email/Username: {{username}}
   - Password: {{password}}

STEP 3: Check for "Remember me" checkbox and check it if present

STEP 4: BEFORE clicking login, check for CAPTCHA/human verification:
   - "Verify you''re human" checkbox
   - "I''m not a robot" checkbox
   - CAPTCHA image/puzzle
   - Cloudflare/Turnstile challenge

   If CAPTCHA IS visible:
   - Attempt to solve it (click checkbox, complete puzzle)
   - If you cannot solve it, report: CAPTCHA_NEEDED: Unable to solve CAPTCHA

   If NO CAPTCHA visible:
   - Proceed to click the login/sign-in button

STEP 5: AFTER clicking login, check the result:

   a) Verification CODE input (email code, SMS code, 2FA, OTP, authenticator):
      - STOP and report: VERIFICATION_NEEDED: [describe what code is needed]
      - DO NOT enter any code

   b) Another CAPTCHA appeared after login:
      - Attempt to solve it
      - If you cannot solve it, report: CAPTCHA_NEEDED: Unable to solve post-login CAPTCHA

   c) Login successful:
      - Navigate to: {{searchUrl}}
      - Report: SUCCESS: Currently at [URL]

CRITICAL REMINDERS:
- Cookie banners = dismiss immediately, NOT a CAPTCHA
- Attempt to solve CAPTCHAs when possible
- VERIFICATION_NEEDED = code input field visible, user will provide code
- Enter credentials FIRST, then check for CAPTCHA',
  date_updated = NOW()
WHERE request = 'browser_use_login_solve_captcha';

-- Verify the updates
SELECT request, substring(user_prompt, 1, 300) as user_prompt_preview
FROM ai_chat_prompts
WHERE request IN ('browser_use_login_report_captcha', 'browser_use_login_solve_captcha');
