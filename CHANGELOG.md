# Changelog

All notable changes to the Smart Job Seeker OSS project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.47] - 2026-04-16

18 commits since v0.4.46.

### Added
- Browser-based E2E test suite covering signup, password reset, applications, job details, profile operations, navigation, feedback, and theme switching—23 tests across all pages
- Trusted origins support for local development testing

### Fixed
- Cookie secure flag handling in production environments
- 12 failing tests across 7 test suites

## [0.4.46] - 2026-04-15

10 commits since v0.4.45.

### Added
- Adaptive favicon that switches between dark and light variants based on current theme
- Inset mode for TabNav to enhance header background styling on tab pages
- Pending invitations section on admin users page with collapsible layout
- Support for accessing billing, contacts, and feedback pages without requiring a profile

### Changed
- Improved multi-row tabs with better back link positioning and merged styleguides
- Header dropdowns now fit content width on desktop
- Unified overlay behavior for sidebar and header dropdowns via shared state

### Fixed
- Fixed cookies.set() error that occurred after response generation
- Fixed container restart to properly apply fresh environment variables

## [0.4.45] - 2026-04-14

63 commits since v0.4.44.

### Added
- Feedback ticket system with replies, merging, and notifications
- Interactive screenshot mode and raw browser input control via Chrome DevTools Protocol
- Login mode setting for import tasks (auto/manual/none)
- Force stop and screenshot browser view functionality
- Device sharing and multi-device support with VNC relay and tunnel resolution
- Self-hosted tunnel client Docker image for NAS/home server deployments
- Security question answer field and automatic answer-filling during login
- New vs existing job status distinction in UI
- Hard ceiling on total items processed per job (3x max_jobs)

### Changed
- Dashboard layout optimized to reduce database round-trips
- Device system redesigned with "My Devices" and connected device names
- Contacts moved to user menu with API key management (rename/activate/delete)
- Email verification link extraction now scores by relevance and uses Cheerio parsing
- Import task detail page mobile layout improved
- Header positioning switched from sticky to fixed
- Device status icon simplified and verification flow routing improved

### Fixed
- Login mode toggle appearing twice in edit mode
- Stale page frame reference after keepCdpConnected intervention
- Verification code fallback after failed link navigation
- Cookie banner dismissal on CookieFirst shadow DOM sites
- Email verification misclassified as magic link
- False CAPTCHA detection on Cloudflare-fronted sites and challenge pages
- Auth block classification (email/2FA checks before security question)
- Cookie banner selector fallback bugs
- Login submit click detection and retry when click has no effect

## [0.4.44] - 2026-04-11

3 commits since v0.4.43.

### Added
- Claude session resume command display on scraper agent detail pages

### Changed
- LLM job extraction validation now validates per-item instead of all-or-nothing

### Fixed
- Scraper agent issues
- Deploy script issues

## [0.4.43] - 2026-04-11

1 commit since v0.4.42.

### Added
- Webhook verification tokens are now stored in the admin inbox

## [0.4.42] - 2026-04-11

1 commit since v0.4.41.

### Fixed
- Handle EmailConnect webhook verification requests

## [0.4.41] - 2026-04-11

2 commits since v0.4.40.

### Added
- Admin inbox page for managing inbound emails

### Changed
- Renamed verification emails to inbound emails throughout the application

### Fixed
- Click handler issue in admin inbox

## [0.4.40] - 2026-04-11

1 commit since v0.4.39.

### Fixed
- Login page now properly waits for Cloudflare challenges to resolve before validating form submission

## [0.4.39] - 2026-04-11

11 commits since v0.4.38.

### Added
- Desktop app connection status check
- Periodic auto-run scheduling for import tasks
- Auto-create match configuration on first visit
- Dashboard success banner after profile creation
- Live job scrape settings adjustment during active scrape
- No-jobs-imported message when no jobs have been imported

### Changed
- Getting started flow now requires skills and experience/education
- Dashboard terminology clarified throughout interface
- Mobile sidebar automatically closes when opening profile or account menu

### Fixed
- SPA login detection reliability
- Profile deletion redirect
- Edit popup closes on back navigation
- Skill reorder pill visibility threshold with fewer than 2 skills

## [0.2.0] - 2026-03-22

314 commits since v0.1.5.

### Added

**Dashboard UI Redesign**
- Unified jobs page with filter tabs replacing separate pages, redesigned job cards with score badges and save/reject functionality
- Job detail page with improved header layout and Browse All Jobs page with match scores
- Redesigned homepage with dashboard styling and invite-only signup with admin approval
- Multi-profile matcher with restructured matching pages and shared eligibility filter
- Match progress dashboard with collapsible sections on the search task page
- Redesigned filter widget with multi-select popovers and icons
- Card component migration across all dashboard pages

**Job Card UX**
- ScoreBadge component with color-coded match scores (green >75, blue 60-79)
- Save/reject toggle with visual feedback and action buttons in card footer
- Matched skills highlighting and skill match percentage display on job cards
- Match summary display with source link in expanded section
- Posted/imported date display on cards

**Search Task & Scraper UI**
- Live scraper status messages and log viewer with real-time SSE streaming
- Browser view with CDP screencast for tunnel and desktop mode
- Scraper options: skip existing, stop after duplicates, skip first N, max jobs
- SearchTaskFields shared component for add/edit pages
- Credential management and editable search/login URLs on search task detail page
- Log level filter for search task logs
- Rescrape monitor with browser view
- Admin scraper logs with copy button

**Profile Management**
- JSON Resume import support
- PDF resume import with LLM extraction
- Export/import data pages with media
- Profile URL slug editing and private links with view mode
- Multi-profile support with per-profile matcher state
- Improved create profile page with unified upload/import flow
- Skills editor improvements: legend toggles, reorder, category support
- Admin user impersonation

**Authentication & Security**
- Auth route group with enforced API auth in hooks
- Magic link login support
- Invite-only signup with admin approval flow

**Infrastructure & DX**
- Switch to Patchright from Playwright for browser automation
- Switch from Resend to SMTP2GO for transactional email
- Browser Control section with `SJS_LOCAL_BROWSER_ALLOWED` env var
- HMR WebSocket proxy config for dev behind Caddy
- Production adapter-node configuration for reverse proxy
- Zod validation across routes
- Bounded queries and centralized config
- Database indexes and N+1 query fixes
- DRY refactor: shared utilities (2 rounds)

**Testing**
- DB layer tests (69 tests)
- Queue management tests (24 tests)
- Scraper logic tests (71 tests)
- API route handler tests (69 tests)
- Auth layer tests (47 tests)

### Changed

- Rename DB collections: `job_searches` to `search_tasks`, `job_match_config` to `match_config`
- Rename auth tables to plural form
- Unified jobs page replaces separate matched/saved/rejected pages

### Fixed

- Fix LLM response format variations: numeric-keyed objects, JSON schema echoing, truncated responses
- Fix eligibility filter case-insensitive matching
- Fix drag-and-drop file upload
- Fix language proficiency mapping for LinkedIn imports
- Fix Prisma compound unique key name
- Fix flaky Docker detection
- Fix missing ownership checks on profile export
- Fix login form submitting credentials in URL
- Fix password reset client method
- Fix sidebar/header overlap
- Various dark theme fixes

### Removed

- Remove `classify_clickables` prompt and schema
- Remove Vercel Analytics
- Remove unused AWS SDK dependencies
- Remove dead browser-use references
- Remove admin logs page (replaced by per-task logs)

## [0.1.5] and earlier

Previous releases.
