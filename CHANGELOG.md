# Changelog

All notable changes to the Smart Job Seeker OSS project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
