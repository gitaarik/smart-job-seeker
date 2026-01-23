-- Fix login detection for "remembered session" states
-- Many platforms show user's name/profile but require one more click to fully log in

-- ============================================================================
-- browser_use_login
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

IMPORTANT: Many sites show your name or profile picture but you are NOT fully logged in yet!

A) FULLY LOGGED IN - you can see ACTUAL JOB CONTENT:
   - Job listings with titles, companies, descriptions
   - Job search results
   - Your applications dashboard with job data
   → Say "Login successful - already logged in at [current URL]"

B) QUICK SIGN-IN available (NOT fully logged in yet):
   - "Welcome back, [Name]" with a "Continue" or "Sign in" button
   - "Sign in as [Name]" with profile picture
   - Pre-filled email/username with "Continue" button
   - Any button that says "Continue", "Sign in as...", or shows your name
   → Click that button to complete the sign-in, then check result

C) INTERACTIVE CAPTCHA (checkbox to click, puzzle to solve):
   → Say "CAPTCHA detected - interactive challenge requires user action"

D) LOGIN FORM (empty username/password fields, no quick sign-in option):
   → Continue to STEP 3

NOTE: Seeing your name or profile picture does NOT mean you are logged in.
You are only logged in if you can see actual job listings or job-related content.

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

Look for INTERACTIVE challenges that require user action:
- "I am not a robot" checkbox that needs clicking
- CAPTCHA image puzzle that needs solving
- Challenge that is blocking and requires user input

If INTERACTIVE CAPTCHA visible:
→ Say "CAPTCHA detected before login submit - interactive challenge requires user action"

If NO interactive CAPTCHA (just normal login button):
→ Click the login/sign-in button

== STEP 5: Check result after clicking login ==

A) Verification CODE needed (email code, SMS, 2FA, OTP):
   → Say "Verification code needed - [email/SMS/2FA]" and include current URL

B) INTERACTIVE CAPTCHA appeared (checkbox, puzzle, challenge requiring user action):
   → Say "CAPTCHA detected after login submit - interactive challenge requires user action"

C) Error message (wrong password, account locked):
   → Say "Login failed - [error message]"

D) Login successful (you can now see job listings or job-related dashboard):
   → Say "Login successful" and include current URL

Always include the current URL in your response.',
date_updated = NOW()
WHERE request = 'browser_use_login';

-- ============================================================================
-- browser_use_navigate_search
-- ============================================================================
UPDATE ai_chat_prompts
SET user_prompt = 'You are a browser automation assistant. Navigate to the job search page and verify it is ready.

== COOKIE BANNERS ==
If you see a cookie consent/privacy banner at ANY point:
- Click "Accept All", "Accept Cookies", "Allow All", "I Agree", "Got it", "OK", or similar
- These are NOT CAPTCHA challenges - just dismiss them and continue

== STEP 1: Navigate to search page ==

Go to this EXACT URL: {{searchUrl}}

== STEP 2: Wait for page to load ==

IMPORTANT: After navigation, you MUST wait 5-10 seconds to allow:
- Cloudflare automatic verification to complete (the "Verifying..." spinner usually passes on its own)
- Page JavaScript to finish loading
- Any redirects to complete

Do NOT immediately report CAPTCHA if you see a brief loading/verification screen.

== STEP 3: Check the page after waiting ==

A) INTERACTIVE CAPTCHA visible - something that REQUIRES user action:
   - Checkbox you must click ("I am not a robot")
   - Puzzle you must solve (image selection, slider, etc.)
   - Challenge that is STUCK and not progressing after waiting
   → Say "CAPTCHA detected on search page - interactive challenge requires user action"

B) Redirected to login page (you see a login form with username/password fields):
   → Say "Redirected to login page - session expired"

C) QUICK SIGN-IN page (shows your name/profile but needs one more click):
   - "Welcome back, [Name]" with Continue button
   - "Sign in as [Name]"
   → Say "Redirected to login page - quick sign-in required"

D) Job search page loaded (you can see ACTUAL JOB LISTINGS with titles and companies):
   → Say "Search page ready - job listings visible at [current URL]"

NOTE: You are only on the search page if you can see actual job listings.
Seeing your name or a personalized greeting is NOT the search page.

Always include the current URL in your response.',
date_updated = NOW()
WHERE request = 'browser_use_navigate_search';

-- ============================================================================
-- browser_use_prepare_session
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

IMPORTANT: Wait 5-10 seconds after navigation for any auto-verification to complete.

CRITICAL: Many sites show your name or profile picture but you are NOT fully logged in!
You are only logged in if you can see ACTUAL JOB CONTENT (job listings, search results).

Look at the current page after waiting:

A) LOGIN FORM (empty username/password fields):
   → Login is required, go to STEP 3

B) QUICK SIGN-IN (shows your name/profile, needs one more click):
   - "Welcome back, [Name]" with a "Continue" button
   - "Sign in as [Name]" with profile picture
   - Pre-filled email with "Continue" button
   → Click that button to complete sign-in, then reassess

C) FULLY LOGGED IN (you can see ACTUAL JOB LISTINGS):
   - Job cards with titles, companies, descriptions visible
   - Search results with real job data
   → Already logged in, skip to STEP 4

D) INTERACTIVE CAPTCHA (checkbox, puzzle, stuck challenge):
   → Say "CAPTCHA detected on initial page - interactive challenge requires user action"

NOTE: Seeing your name or "Welcome back" is NOT being logged in.
You must see actual job content to confirm you are logged in.

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

BEFORE clicking login, check for INTERACTIVE CAPTCHA (checkbox, puzzle, challenge requiring action):

If INTERACTIVE CAPTCHA visible BEFORE login:
→ Say "CAPTCHA detected before login submit - interactive challenge requires user action"

If NO CAPTCHA visible:
→ Click the login/sign-in button

AFTER clicking login, check what happened:

A) Verification CODE needed (email code, SMS, 2FA, OTP, authenticator):
   → Say "Verification code needed - [email/SMS/2FA]"
   → DO NOT enter any code

B) INTERACTIVE CAPTCHA appeared after login:
   → Say "CAPTCHA detected after login - interactive challenge requires user action"

C) Error message (wrong password, account locked):
   → Say "Login failed - [error message]"

D) Login successful (you can now see job listings or dashboard with job data):
   → Continue to STEP 4

== STEP 4: Navigate to search page ==

IMPORTANT: You MUST navigate to this EXACT URL, even if you are already on a different jobs page:
{{searchUrl}}

After navigating, WAIT 5-10 seconds for the page to fully load. Then check:

A) INTERACTIVE CAPTCHA on the search page (checkbox, puzzle, stuck challenge):
   → Say "CAPTCHA detected on search page - interactive challenge requires user action"

B) Redirected back to login page or quick sign-in:
   → Say "Redirected to login page"

C) Job search page loaded (you can see ACTUAL JOB LISTINGS with titles and companies):
   → Say "Login successful - search page ready with job listings at [current URL]"

NOTE: Do not report ready until you can see actual job listings at {{searchUrl}}.

Always include the current URL in your response.',
date_updated = NOW()
WHERE request = 'browser_use_prepare_session';

-- Verify
SELECT request, substring(user_prompt, 1, 200) as preview
FROM ai_chat_prompts
WHERE request IN ('browser_use_login', 'browser_use_navigate_search', 'browser_use_prepare_session');
