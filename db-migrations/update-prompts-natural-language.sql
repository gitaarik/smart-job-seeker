-- Update Browser-Use prompts to use natural language instead of JSON format.
-- The LLM will describe outcomes in natural language, which TypeScript parses via pattern matching.

-- ============================================================================
-- 1. browser_use_login: Handle login page
-- ============================================================================
UPDATE ai_chat_prompts
SET user_prompt = 'You are a browser automation assistant. Your task is to log into a website.

== COOKIE BANNERS ==
If you see a cookie consent/privacy banner at ANY point:
- Click "Accept All", "Accept Cookies", "Allow All", "I Agree", "Got it", "OK", or similar
- Cookie banners are NOT CAPTCHA challenges - just dismiss them and continue

== STEP 1: Navigate to login page ==

Go to: {{loginUrl}}

== STEP 2: Check current state ==

A) If you see job listings, dashboard, or authenticated content:
   → Say "Login successful - already logged in at [current URL]"

B) If you see a CAPTCHA challenge:
   → Say "CAPTCHA detected - manual intervention needed"

C) If you see a login form:
   → Continue to STEP 3

== STEP 3: Enter credentials ==

- Username/Email: {{username}}
- Password: {{password}}

If username is empty or "(no credentials)":
→ Say "Login failed - no credentials provided"

Fill in the credentials:
1. Enter username/email
2. Enter password
3. Check "Remember me" if present

== STEP 4: Check for CAPTCHA before submit ==

Look for:
- "Verify you are human" checkbox
- "I am not a robot" checkbox
- CAPTCHA image/puzzle
- Cloudflare/Turnstile challenge

If CAPTCHA visible:
→ Say "CAPTCHA detected before login submit"

If NO CAPTCHA:
→ Click the login/sign-in button

== STEP 5: Check result after clicking login ==

A) Verification CODE needed (email code, SMS, 2FA, OTP):
   → Say "Verification code needed - [email/SMS/2FA]" and include current URL

B) CAPTCHA appeared:
   → Say "CAPTCHA detected after login submit"

C) Error message (wrong password, account locked):
   → Say "Login failed - [error message]"

D) Login successful (redirected to dashboard/home, see authenticated content):
   → Say "Login successful" and include current URL

Always include the current URL in your response.',
date_updated = NOW()
WHERE request = 'browser_use_login';

-- ============================================================================
-- 2. browser_use_navigate_search: Navigate to search page after login
-- ============================================================================
UPDATE ai_chat_prompts
SET user_prompt = 'You are a browser automation assistant. Navigate to the job search page and verify it is ready.

== COOKIE BANNERS ==
If you see a cookie consent/privacy banner at ANY point:
- Click "Accept All", "Accept Cookies", "Allow All", "I Agree", "Got it", "OK", or similar
- These are NOT CAPTCHA challenges - just dismiss them and continue

== STEP 1: Navigate to search page ==

Go to this EXACT URL: {{searchUrl}}

Wait for the page to fully load (3-5 seconds).

== STEP 2: Check the page ==

A) CAPTCHA challenge visible (puzzle, "verify you are human", Cloudflare, loading that never completes):
   → Say "CAPTCHA detected on search page"

B) Redirected to login page (you see a login form):
   → Say "Redirected to login page - session expired"

C) Job search page loaded (you can see job listings or search results):
   → Say "Search page ready - job listings visible at [current URL]"

Always include the current URL in your response.',
date_updated = NOW()
WHERE request = 'browser_use_navigate_search';

-- ============================================================================
-- 3. browser_use_prepare_session: Merged flow when no login_page_url
-- ============================================================================
UPDATE ai_chat_prompts
SET user_prompt = 'You are a browser automation assistant preparing a session for job scraping.

GOAL: Get to the job search page and confirm it is ready for extraction.

== COOKIE BANNERS ==
If you see a cookie consent/privacy banner at ANY point during this process:
- Click "Accept All", "Accept Cookies", "Allow All", "I Agree", "Got it", "OK", or similar
- Cookie banners are NOT CAPTCHA challenges - just dismiss them and continue

== STEP 1: Navigate to {{startUrl}} ==

Go to this URL. This may be:
- A login page (if login is required)
- The search page directly (if already logged in)
- Some other page that redirects

== STEP 2: Assess the page ==

Look at the current page after navigation:

A) If you see a LOGIN FORM (username/password fields, "Sign in", "Log in"):
   → Login is required, go to STEP 3

B) If you can see job listings, search results, dashboard, or any authenticated content:
   → Already logged in, skip to STEP 4 (but you MUST still navigate to the search URL!)

C) If you see a CAPTCHA challenge (puzzle, "verify you are human", Cloudflare):
   → Say "CAPTCHA detected on initial page"

== STEP 3: Login (only if login form was visible) ==

Credentials to use:
- Username: {{username}}
- Password: {{password}}

If username is empty or says "(no credentials)":
→ Say "Login failed - no credentials provided"

Otherwise, fill in the credentials:
1. Enter the username/email
2. Enter the password
3. Check "Remember me" if present

BEFORE clicking login, check for CAPTCHA:
- "Verify you are human" checkbox
- "I am not a robot" checkbox
- CAPTCHA image/puzzle
- Cloudflare/Turnstile challenge

If CAPTCHA visible BEFORE login:
→ Say "CAPTCHA detected before login submit"

If NO CAPTCHA visible:
→ Click the login/sign-in button

AFTER clicking login, check what happened:

A) Verification CODE needed (email code, SMS, 2FA, OTP, authenticator):
   → Say "Verification code needed - [email/SMS/2FA]"
   → DO NOT enter any code

B) CAPTCHA appeared after login:
   → Say "CAPTCHA detected after login"

C) Error message (wrong password, account locked):
   → Say "Login failed - [error message]"

D) Login successful (redirected, see dashboard/home):
   → Continue to STEP 4

== STEP 4: Navigate to search page ==

IMPORTANT: You MUST navigate to this EXACT URL, even if you are already on a different jobs page:
{{searchUrl}}

This is required because different pages may have different CAPTCHA behavior.
Use the go_to_url action to navigate to this exact URL.

After navigating, WAIT 3-5 seconds for the page to fully load, then check:

A) CAPTCHA challenge on the search page (puzzle, "verify you are human", Cloudflare, loading spinner that doesn''t go away):
   → Say "CAPTCHA detected on search page"

B) Redirected back to login page:
   → Say "Redirected to login page"

C) Job search page loaded successfully (you can see job listings):
   → Say "Login successful - search page ready with job listings at [current URL]"

NOTE: Do not report ready until you have ACTUALLY navigated to {{searchUrl}} and confirmed it loaded.

Always include the current URL in your response.',
date_updated = NOW()
WHERE request = 'browser_use_prepare_session';

-- Verify
SELECT request, substring(user_prompt, 1, 100) as preview
FROM ai_chat_prompts
WHERE request IN ('browser_use_login', 'browser_use_navigate_search', 'browser_use_prepare_session');
