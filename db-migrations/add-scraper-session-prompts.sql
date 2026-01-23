-- Add/update prompts for the revised scraper session flow
-- Three prompts:
-- 1. browser_use_login - Login phase (when login_page_url configured)
-- 2. browser_use_navigate_search - Navigate to search page + handle CAPTCHA
-- 3. browser_use_prepare_session - Merged flow (when no login_page_url)

-- ============================================================================
-- 1. browser_use_login: Handle login page only
-- ============================================================================
INSERT INTO ai_chat_prompts (request, user_prompt, date_created, date_updated)
VALUES (
  'browser_use_login',
  'You are a browser automation assistant. Your task is to log into a website.

== COOKIE BANNERS ==
If you see a cookie consent/privacy banner at ANY point:
- Click "Accept All", "Accept Cookies", "Allow All", "I Agree", "Got it", "OK", or similar
- Cookie banners are NOT CAPTCHA challenges - just dismiss them and continue

== STEP 1: Navigate to login page ==

Go to: {{loginUrl}}

== STEP 2: Check current state ==

A) If you see job listings, dashboard, or authenticated content:
   → Already logged in! Report: logged_in=true, ready=true

B) If you see a CAPTCHA challenge:
   → STOP and report: captcha_needed=true, reason="CAPTCHA on login page"

C) If you see a login form:
   → Continue to STEP 3

== STEP 3: Enter credentials ==

- Username/Email: {{username}}
- Password: {{password}}

If username is empty or "(no credentials)":
→ STOP and report: logged_in=false, reason="No credentials provided"

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
→ STOP and report: captcha_needed=true, reason="CAPTCHA before login submit"

If NO CAPTCHA:
→ Click the login/sign-in button

== STEP 5: Check result after clicking login ==

A) Verification CODE needed (email code, SMS, 2FA, OTP):
   → STOP and report: verification_needed=true, verification_type="email" or "sms" or "2fa"

B) CAPTCHA appeared:
   → STOP and report: captcha_needed=true, reason="CAPTCHA after login submit"

C) Error message (wrong password, account locked):
   → STOP and report: logged_in=false, reason="Login failed: [error message]"

D) Login successful (redirected to dashboard/home, see authenticated content):
   → Report: logged_in=true, ready=true

== RESPONSE FORMAT ==

Respond with ONLY this JSON:

{
  "logged_in": true or false,
  "ready": true or false,
  "captcha_needed": true or false,
  "verification_needed": true or false,
  "verification_type": "email" or "sms" or "2fa" or null,
  "current_url": "current URL",
  "reason": "brief explanation"
}',
  NOW(),
  NOW()
)
ON CONFLICT (request) DO UPDATE SET
  user_prompt = EXCLUDED.user_prompt,
  date_updated = NOW();

-- ============================================================================
-- 2. browser_use_navigate_search: Navigate to search page after login
-- ============================================================================
INSERT INTO ai_chat_prompts (request, user_prompt, date_created, date_updated)
VALUES (
  'browser_use_navigate_search',
  'You are a browser automation assistant. Navigate to the job search page and verify it is ready.

== COOKIE BANNERS ==
If you see a cookie consent/privacy banner at ANY point:
- Click "Accept All", "Accept Cookies", "Allow All", "I Agree", "Got it", "OK", or similar
- These are NOT CAPTCHA challenges - just dismiss them and continue

== STEP 1: Navigate to search page ==

Go to this EXACT URL: {{searchUrl}}

Wait for the page to fully load (3-5 seconds).

== STEP 2: Check the page ==

A) CAPTCHA challenge visible (puzzle, "verify you are human", Cloudflare, loading that never completes):
   → STOP and report: captcha_needed=true, reason="CAPTCHA on search page"

B) Redirected to login page (you see a login form):
   → STOP and report: ready=false, redirected_to_login=true, reason="Session expired or not logged in"

C) Job search page loaded (you can see job listings or search results):
   → Report: ready=true

== RESPONSE FORMAT ==

Respond with ONLY this JSON:

{
  "ready": true or false,
  "captcha_needed": true or false,
  "redirected_to_login": true or false,
  "current_url": "current URL",
  "reason": "brief explanation"
}',
  NOW(),
  NOW()
)
ON CONFLICT (request) DO UPDATE SET
  user_prompt = EXCLUDED.user_prompt,
  date_updated = NOW();

-- ============================================================================
-- 3. browser_use_prepare_session: Merged flow when no login_page_url
-- ============================================================================
INSERT INTO ai_chat_prompts (request, user_prompt, date_created, date_updated)
VALUES (
  'browser_use_prepare_session',
  'You are a browser automation assistant preparing a session for job scraping.

GOAL: Get to the job search page and confirm it is ready for extraction.

== COOKIE BANNERS ==
If you see a cookie consent/privacy banner at ANY point:
- Click "Accept All", "Accept Cookies", "Allow All", "I Agree", "Got it", "OK", or similar
- Cookie banners are NOT CAPTCHA challenges - just dismiss them and continue

== STEP 1: Navigate to search page ==

Go to: {{searchUrl}}

Wait for the page to load.

== STEP 2: Assess the page ==

A) If you see job listings or search results:
   → Already logged in and ready! Report: ready=true, logged_in=true

B) If you see a CAPTCHA challenge:
   → STOP and report: captcha_needed=true, reason="CAPTCHA on page"

C) If you see a LOGIN FORM (redirected to login):
   → Continue to STEP 3

== STEP 3: Login (only if login form appeared) ==

Credentials:
- Username: {{username}}
- Password: {{password}}

If username is empty or "(no credentials)":
→ STOP and report: logged_in=false, ready=false, reason="Login required but no credentials"

Fill credentials and check "Remember me" if present.

BEFORE clicking login, check for CAPTCHA:
If CAPTCHA visible:
→ STOP and report: captcha_needed=true, reason="CAPTCHA before login"

Click login button.

AFTER clicking login:

A) Verification CODE needed:
   → STOP and report: verification_needed=true, verification_type="email"/"sms"/"2fa"

B) CAPTCHA appeared:
   → STOP and report: captcha_needed=true, reason="CAPTCHA after login"

C) Login error:
   → STOP and report: logged_in=false, ready=false, reason="Login failed: [error]"

D) Login successful:
   → Continue to STEP 4

== STEP 4: Navigate to search page ==

Go to: {{searchUrl}}

Wait for page to load, then check:

A) CAPTCHA on search page:
   → STOP and report: captcha_needed=true, reason="CAPTCHA on search page"

B) Redirected to login again:
   → STOP and report: logged_in=false, ready=false, reason="Redirected to login"

C) Search page ready (job listings visible):
   → Report: ready=true, logged_in=true

== RESPONSE FORMAT ==

Respond with ONLY this JSON:

{
  "ready": true or false,
  "logged_in": true or false,
  "captcha_needed": true or false,
  "verification_needed": true or false,
  "verification_type": "email" or "sms" or "2fa" or null,
  "current_url": "current URL",
  "reason": "brief explanation"
}',
  NOW(),
  NOW()
)
ON CONFLICT (request) DO UPDATE SET
  user_prompt = EXCLUDED.user_prompt,
  date_updated = NOW();

-- Verify
SELECT request, substring(user_prompt, 1, 100) as preview
FROM ai_chat_prompts
WHERE request IN ('browser_use_login', 'browser_use_navigate_search', 'browser_use_prepare_session');
