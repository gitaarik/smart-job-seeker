# Changelog

All notable changes to the Smart Job Seeker OSS project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.110] - 2026-04-23

1 commit since v0.4.109.

### Changed
- Broadcast secret in preview environment configuration is now stored unencrypted

## [0.4.109] - 2026-04-23

2 commits since v0.4.108.

### Fixed
- Verification emails are now always stored in admin inbox, even for unknown tokens

### Changed
- Broadcast targets are now stored unencrypted

## [0.4.108] - 2026-04-23

4 commits since v0.4.107.

### Added
- Email webhook broadcast system for event-driven delivery
- Rich digest email template with send-now button and skill matching
- Sent emails admin page with outbound email logging and audit trail
- Score color utilities for consistent visualization

## [0.4.107] - 2026-04-22

2 commits since v0.4.106.

### Added
- Display running task progress message on task list cards

## [0.4.106] - 2026-04-22

1 commit since v0.4.105.

### Fixed
- Runs stuck in stopping state now automatically recover after 2 minutes

## [0.4.105] - 2026-04-22

4 commits since v0.4.104.

### Added
- 15-second timeout to CDP connections to prevent indefinite hangs

### Changed
- Import task display improvements: clock icon for queued status and schedule time in the status pill

### Fixed
- Cancel checker now properly detects 'stopping' status

## [0.4.104] - 2026-04-22

1 commit since v0.4.103.

### Added
- Task list cards now display the next scheduled run time

## [0.4.103] - 2026-04-22

3 commits since v0.4.102.

### Added
- Preferred time and timezone support for search task scheduling

## [0.4.102] - 2026-04-22

10 commits since v0.4.101.

### Added
- Account settings page for managing email address and timezone
- Email digest customization: set preferred send time, timezone, and recipient email
- Database schema migrations for account settings and email digest features

### Changed
- Email digest UI: improved schedule widget and layout
- Release process: now aborts if database schema has unmigrated changes
- Build optimization: free dev container resources during release builds

### Fixed
- Docker build compatibility: removed --cpus flag that required buildx

## [0.4.101] - 2026-04-22

2 commits since v0.4.100.

### Added
- Email digest profile database migrations

## [0.4.100] - 2026-04-22

4 commits since v0.4.99.

### Added
- Email digest notifications for job matches with corresponding worker loop

### Changed
- Import task scheduling now uses longer intervals (weekly and bi-weekly)

## [0.4.99] - 2026-04-22

1 commit since v0.4.98.

### Added
- Cloud billing overlays in the application

## [0.4.98] - 2026-04-21

1 commit since v0.4.97.

### Fixed
- VNC tab focus now correctly brought to front on new tabs in all modes

## [0.4.97] - 2026-04-21

1 commit since v0.4.96.

### Fixed
- Logs overlay scrolling and auto-scroll to bottom functionality restored

## [0.4.96] - 2026-04-21

2 commits since v0.4.95.

### Changed
- Improved browser view popup with copy feedback, transparent logs, and overlay controls

## [0.4.95] - 2026-04-21

1 commit since v0.4.94.

### Fixed
- OTP code submission now properly triggers input events and skips disabled buttons

## [0.4.94] - 2026-04-20

1 commit since v0.4.93.

### Fixed
- Cookie banner dismissal now requires exact match for short patterns

## [0.4.93] - 2026-04-20

1 commit since v0.4.92.

### Fixed
- Magic link detection now properly waits for SPA rendering and supports additional patterns

## [0.4.92] - 2026-04-20

1 commit since v0.4.91.

### Fixed

- Device status now correctly updates when switching to tunnel mode

## [0.4.91] - 2026-04-20

2 commits since v0.4.90.

### Fixed
- Import task page UI: continue button, credential delete, and add button functionality
- Auto-clear skip_first flag after successful scraper run

## [0.4.90] - 2026-04-20

2 commits since v0.4.89.

### Fixed
- Fixed platform_id field references in login URL save and scheduler

## [0.4.89] - 2026-04-20

2 commits since v0.4.88.

### Fixed

- Browser view now displays correctly for GoLogin cloud mode

## [0.4.88] - 2026-04-20

2 commits since v0.4.87.

### Added
- noVNC static files for tunnel VNC viewer

## [0.4.87] - 2026-04-20

1 commit since v0.4.86.

### Added
- Post-build verification for worker bundle

## [0.4.86] - 2026-04-20

1 commit since v0.4.85.

### Fixed
- Fixed worker crash related to Sentry build-time dependencies

## [0.4.85] - 2026-04-20

5 commits since v0.4.84.

### Changed
- Completed migration of scraper worker from Prisma to Drizzle ORM

### Fixed
- Fixed duplicate key error and improved log loading behavior in browser popup
- Fixed matcher toISOString crash when converting database query date strings
- Resolved scraper Drizzle migration issues

## [0.4.84] - 2026-04-20

2 commits since v0.4.83.

### Fixed
- Fixed Drizzle relation name mismatches in Svelte templates

## [0.4.83] - 2026-04-19

1 commit since v0.4.82.

### Fixed

- Fixed date formatting crash in profile/full export

## [0.4.82] - 2026-04-19

2 commits since v0.4.81.

### Fixed

- Fixed date formatting crash when Drizzle returns date strings

## [0.4.81] - 2026-04-19

2 commits since v0.4.80.

### Changed
- Externalized @babel dependencies from worker build

## [0.4.80] - 2026-04-19

2 commits since v0.4.79.

### Fixed
- Fixed CJS/ESM conflicts in production builds

## [0.4.79] - 2026-04-19

1 commit since v0.4.78.

### Fixed
- Restore Docker build caching in release script to improve build performance

## [0.4.78] - 2026-04-19

2 commits since v0.4.77.

### Fixed
- CJS/ESM module conflicts in Docker builds and SSR bundle
- Docker build caching performance

## [0.4.77] - 2026-04-19

2 commits since v0.4.76.

### Fixed
- Sentry CJS/ESM conflict in production builds

### Changed
- Externalized import-in-the-middle from SSR bundle

## [0.4.76] - 2026-04-19

1 commit since v0.4.75.

### Fixed
- Fixed CJS/ESM conflict with bullmq by externalizing it from the SSR bundle

## [0.4.75] - 2026-04-19

2 commits since v0.4.74.

### Added
- Drizzle migrations are now included in production Docker images

## [0.4.74] - 2026-04-19

2 commits since v0.4.73.

### Fixed
- Initial Drizzle migration failing on existing databases

## [0.4.73] - 2026-04-19

1 commits since v0.4.72.

### Fixed
- Fixed environment variables not being passed to drizzle-kit migrations during deployment

## [0.4.72] - 2026-04-19

2 commits since v0.4.71.

### Changed
- Completed migration from Prisma to Drizzle ORM in frontend and removed Prisma from backend

## [0.4.71] - 2026-04-19

6 commits since v0.4.70.

### Changed
- Migrated database ORM from Prisma to Drizzle across frontend and backend, with all queries converted to native Drizzle

## [0.4.70] - 2026-04-18

1 commit since v0.4.69.

### Changed
- Externalize Prisma runtime from worker bundle for improved performance

## [0.4.69] - 2026-04-18

2 commits since v0.4.68.

### Changed
- Externalized cheerio from SSR bundle for improved performance

## [0.4.68] - 2026-04-18

1 commit since v0.4.67.

### Changed
- Bundled @prisma packages in worker build

## [0.4.67] - 2026-04-18

1 commit since v0.4.66.

### Changed
- Pin Prisma to exact versions for improved deployment consistency

## [0.4.66] - 2026-04-18

4 commits since v0.4.65.

### Changed
- Pinned Prisma packages to exact versions
- Switched to pre-built Docker images from registry

## [0.4.65] - 2026-04-18

2 commits since v0.4.64.

### Changed
- Deploy tag argument is now optional and defaults to the latest tag

### Fixed
- Deploy now uses --no-cache to prevent stale Prisma client

## [0.4.64] - 2026-04-18

2 commits since v0.4.63.

### Added
- Reusable CopyButton component with clipboard feedback

### Changed
- Improved devices page

## [0.4.63] - 2026-04-18

3 commits since v0.4.62.

### Added
- GlitchTip/Sentry error tracking across app, frontend, and worker

### Fixed
- PDF generation loading indicator now reflects actual progress

## [0.4.62] - 2026-04-18

### Changed
- Split requireCredits into separate module for clean OSS/cloud separation

## [0.4.61] - 2026-04-18

2 commits since v0.4.60.

### Added
- Billing implementation for cloud deployments with volume mount overlay support

## [0.4.60] - 2026-04-18

1 commit since v0.4.59.

### Changed
- Improved resume/CV page: always show regenerate button and group downloads

## [0.4.59] - 2026-04-18

2 commits since v0.4.58.

### Added
- Admin file browser page

## [0.4.58] - 2026-04-18

6 commits since v0.4.57.

### Added
- Adminer database management tool

### Changed
- Renamed file storage references from `directus_files` to `files`

### Removed
- Removed all Directus CMS integration

## [0.4.57] - 2026-04-17

2 commits since v0.4.56.

### Removed
- Title field from work experience achievements

### Added
- Test commands

## [0.4.56] - 2026-04-17

2 commits since v0.4.55.

### Fixed
- Fixed Patchright chromium version mismatch in Docker builds

## [0.4.55] - 2026-04-17

2 commits since v0.4.54.

### Changed
- Renamed `job_matches.job` field to `job_id` across job matcher status, jobs page, and import progress

## [0.4.54] - 2026-04-17

2 commits since v0.4.53.

### Fixed
- Fixed Docker build by making BullMQ queue instances lazy

## [0.4.53] - 2026-04-17

3 commits since v0.4.52.

### Added
- Editable invite expiry dates with a 30-day default and revoke button

### Changed
- Plan cards now display as a flat bullet list with monthly usage indicators

### Fixed
- Fixed impersonation banner being hidden behind the fixed header

## [0.4.52] - 2026-04-17

2 commits since v0.4.51.

### Changed
- Column rename migration now runs automatically in production startup

## [0.4.51] - 2026-04-17

3 commits since v0.4.50.

### Removed
- Directus CMS integration

### Changed
- File storage migrated to local filesystem
- Foreign key columns renamed for consistency across frontend and backend

## [0.4.50] - 2026-04-17

3 commits since v0.4.49.

### Changed
- Release script now atomically pushes changes with automatic rollback on failure

### Fixed
- Fixed Docker build path issue in release script
- Fixed changelog generation failing on empty commits

## [0.4.49] - 2026-04-17

1 commit since v0.4.48.

### Added
- npm scripts for dotenvx environment variable management (`env:set`, `env:set:plain`, `env:get`)

## [0.4.48] - 2026-04-16

5 commits since v0.4.47.

### Added
- Umami analytics integration with environment configuration for observability

### Changed
- Updated Caddy reverse proxy scripts for config/ → caddy/ directory rename

### Fixed
- Test environment: excluded E2E tests from unit test suite and fixed generated file permissions
- Local development: added localhost to trusted origins and fixed file ownership handling with HOST_UID/GID

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
