-- Add prompt for checking login state by analyzing page content
-- This determines if a user is logged in after navigating to the login page

INSERT INTO ai_chat_prompts (
  request,
  system_prompt,
  user_prompt,
  format,
  date_created,
  date_updated
) VALUES (
  'check_login_state',

  -- System Prompt
  'You are analyzing a web page to determine if a user is logged in to a job platform.

Context: The system navigated to the login page URL and is checking if the user was redirected
(indicating they are already logged in) or if they are still on a login page (not logged in).

LOGIN PAGE INDICATORS (user is NOT logged in):
- Login/sign in form with username/email and password fields
- "Sign in", "Log in", "Enter your email" text
- Social login buttons (Google, LinkedIn, etc.) on a login page
- "Create account", "Register", "Sign up" links
- Password reset links
- Text like "Don''t have an account?"

LOGGED IN INDICATORS (user IS logged in):
- Profile menu, avatar, or user name displayed
- "Log out", "Sign out" buttons or links
- Dashboard, feed, or job search content
- "My jobs", "Saved jobs", "Applications" links
- Navigation showing authenticated user features
- Welcome message with user name

Be careful:
- Some sites show job listings without login, but this doesn''t mean logged in
- Look for actual authentication indicators, not just content being visible
- A redirect from login page to dashboard/home strongly indicates logged in
- Error pages or "access denied" messages mean NOT logged in',

  -- User Prompt
  'Analyze this page to determine if the user is logged in.

Context:
- Original login URL navigated to: {{loginPageUrl}}
- Current URL after navigation: {{currentUrl}}
- URL changed (redirect occurred): {{urlChanged}}

Page content (text extracted from HTML):
{{strippedHtml}}

Determine if the user is logged in based on:
1. Was there a redirect from the login page to a different page?
2. Is this still a login/signin page with username/password fields?
3. Are there indicators of being logged in (profile menu, logout button, dashboard)?
4. Is this an error page, CAPTCHA page, or access denied page?

Respond with your analysis.',

  -- Format (kept for backwards compatibility, actual schema is in TypeScript)
  NULL,

  NOW(),
  NOW()
)
ON CONFLICT (request) DO UPDATE SET
  system_prompt = EXCLUDED.system_prompt,
  user_prompt = EXCLUDED.user_prompt,
  format = EXCLUDED.format,
  date_updated = NOW();
