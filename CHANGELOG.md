# Changelog

All notable changes to the Smart Job Seeker OSS project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

1 commit since v0.5.0.

## [0.5.86] - 2026-06-27

2 commits since v0.5.85.

### Fixed
- Shared-credential tasks now correctly pin to owner device; fixed device coupling validation

## [0.5.85] - 2026-06-27

2 commits since v0.5.84.

### Added
- Demo scrapers can now use shared creator credentials
- Demo mode now provides a read-only browser view

### Changed
- Release image builds now run on the self-hosted runner

## [0.5.84] - 2026-06-27

2 commits since v0.5.83.

### Added
- Open Browser / Browser View button now displays based on import run state

### Fixed
- Improved handling of provider rate limits by respecting retry-after headers

## [0.5.83] - 2026-06-27

2 commits since v0.5.82.

### Fixed
- Demo templates can be seeded via the admin UI; provisioning is hardened to self-heal

## [0.5.82] - 2026-06-27

16 commits since v0.5.81.

### Added
- Demo invite links with auto-login and device sharing
- Seed demo templates via in-database profile cloning
- Semantic skill-matching embedding layer (disabled by default)
- Link to how-it-works guide on profile creation
- Hourly automatic demo-link cleanup in worker

### Changed
- Move applications status box to top with one-tap quick updates
- Matcher uses semantically-expanded profile skills for improved matching

### Fixed
- Shorten profile-version relation keys to prevent PostgreSQL identifier truncation

## [0.5.81] - 2026-06-16

2 commits since v0.5.80.

### Added
- Job platform and view-details call-to-action per job in digest

## [0.5.80] - 2026-06-15

14 commits since v0.5.79.

### Added
- In-app user guide with contextual links to dashboard pages, accessible from the user menu
- Top Matches as a first-class filter with infinite scroll (replacing hidden sort)
- Collapsible device setup instructions
- Ability to view which devices are shared with each contact

### Changed
- Filter bar layout with improved spacing and control distribution

### Fixed
- Device setup toggle refresh behavior

## [0.5.79] - 2026-06-15

8 commits since v0.5.78.

### Added
- Device connection wizard with live status for new API keys
- One-link invites for sharing device keys
- Per-device and per-sharee scrape rate budgets with device tracking

### Fixed
- pdf-parse handling in Vite SSR builds

## [0.5.78] - 2026-06-13

10 commits since v0.5.77.

### Added
- Database-backed FX rates with day/month/year display on salary adjustments (auto-refreshed by worker)
- Manual reordering for side-projects and work-experience lists (defaults to date order)

### Changed
- Profile section renamed from "Account" to "Profile Settings"

### Fixed
- PDF cache revalidation ensures regenerated exports serve immediately

## [0.5.77] - 2026-06-10

19 commits since v0.5.76.

### Changed
- Upgraded frontend dependencies: pdf-parse (2.4.5), Font Awesome icons (7.2.0), Marked markdown parser (18.0.5), and Svelte build tooling (7.1.2)
- Upgraded backend dependencies: Commander (15.0.0), TypeScript (6.0.3), Node types (25.9.2), and GitHub Actions for Docker and Python
- Updated Docker base image to Ubuntu 26.04 with enhanced CI build configuration
- Multiple minor and patch version updates across both frontend and backend

### Fixed
- Applied security patches to xmldom, underscore, and defu
- Resolved remaining Dependabot security alerts in development tooling
- Optimized CI workflow by skipping commitlint validation for Dependabot PRs

## [0.5.76] - 2026-06-10

2 commits since v0.5.75.

### Added
- Age-decay ranking algorithm for Top Matches to prioritize recently-updated job postings
- Debug and operations endpoints for match-stats data access

## [0.5.75] - 2026-06-09

1 commit since v0.5.74.

### Fixed
- UI: Floating AI launcher no longer obscures page content

## [0.5.74] - 2026-06-08

1 commit since v0.5.73.

### Fixed
- Container image publishing now uses a single manifest instead of an OCI index with provenance

## [0.5.73] - 2026-06-07

50 commits since v0.5.72.

### Added
- Auto-generate import tasks from profile + preferences with plan-based scheduling
- Auto-assign user's browser device to generated import tasks
- Inline enable/disable for import tasks on overview page
- Import task readiness gates with UI indicating missing setup steps
- Auto-promote job proposals when they become runnable
- Runnability-tiered auto-import top-up with grouped task list
- Keep auto-task login_mode in sync with platform on recompute
- Docker image security scanning (dockle + grype vulnerability scans)
- CI: PR description validation, general-checks workflow (yamllint, hadolint, lint-git), commitlint enforcement

### Changed
- Import task UI: reordered active toggle first, improved pill layout
- Digest: render job attributes (type, experience, location) as label pills
- sjs-browser moved to submodule architecture

### Fixed
- Docker security scan fatal-level exit handling
- Release script: keep dev server available during release
- Release: properly reflect manual :latest image promotion

### Removed
- In-tree sjs-browser source and CI (replaced by submodule)

## [0.5.72] - 2026-06-06

48 commits since v0.5.71.

### Added
- Personal AI assistant with persistent conversation history
- Manual application creation with linked job
- Drag-and-drop reordering for achievements
- Automated dependency updates via Dependabot
- Release and unit test CI workflows

### Fixed
- Kysely 0.28.17 production build issues (direct dependency declaration, bundle externalization)
- Docker base image reverted to Ubuntu 22.04
- E2E test failures (stale routes, dynamic job heading, strict-mode tab locators)
- Interview cheat-sheet heading rendering (h1/h2)
- Credentials auto-selection for import tasks
- Safe-markdown URL sanitizer scheme denylist bypass

### Changed
- Node runtime upgraded from 22-slim to 26-slim
- Resume/CV on-screen content widened to match PDF width
- AgentChat panel grows while typing, collapses on Esc/outside-click
- Scraper refactored for better testability with new unit tests
- Search form refactored and simplified
- Matcher and stealth modules refactored
- Multiple dependency updates (vite 6.4.1→8.0.16, vitest 2.1.9→4.1.0, langsmith 0.5.20→0.7.5, @fortawesome/free-brands-svg-icons 6.7.2→7.2.0, wait-on 8.0.5→9.0.10, plus 63 additional npm minor/patch updates)

## [0.5.71] - 2026-05-28

1 commit since v0.5.70.

### Added
- Per-credential Chrome profile directories on the NAS for improved session isolation

## [0.5.70] - 2026-05-28

3 commits since v0.5.69.

### Added
- Freelance vs employment income preview

### Changed
- Tunnel now sends platform-profile ID to the client

## [0.5.69] - 2026-05-28

1 commit since v0.5.68.

### Fixed
- Prevented screenshot captures from being taken while input is active

## [0.5.68] - 2026-05-27

1 commits since v0.5.67.

### Changed
- Moved WebSocket envelope traces to debug level to reduce cloud log verbosity

## [0.5.67] - 2026-05-27

2 commits since v0.5.66.

### Fixed
- Eliminated GlitchTip error monitoring noise from array casting and 404 scanner activity

### Changed
- Completed job/profile column naming consistency in matcher module

## [0.5.66] - 2026-05-27

2 commits since v0.5.65.

### Fixed
- Client log forwarding now waits for authentication before sending
- Email digest preferred hour no longer locks to a specific period

## [0.5.65] - 2026-05-27

2 commits since v0.5.64.

### Added
- Enhanced scraper logs with steps, source, audience, step ID, and metadata columns; added cross-process tunnel log forwarding for improved run debugging

## [0.5.64] - 2026-05-27

9 commits since v0.5.63.

### Added
- Mid-senior aliases for the mid search filter

### Fixed
- Search filters: hours_commitment now correctly opens employment-type and job-type popups
- Form configuration: improved reliability with better popup detection, state verification, and timeout handling

## [0.5.63] - 2026-05-27

4 commits since v0.5.62.

### Fixed
- Modal portal positioning to <body> and dim overlay cut-off
- Chromium dependencies installation in production Docker image
- Form commit URL change validation

## [0.5.62] - 2026-05-26

1 commit since v0.5.61.

### Added
- Admin tool to clear unsupported_filters from the platform detail page

## [0.5.61] - 2026-05-26

1 commit since v0.5.60.

### Fixed
- Form configuration no longer marks openers as failed on transient click errors

## [0.5.60] - 2026-05-26

1 commit since v0.5.59.

### Fixed
- Form config now remembers and avoids previously failed LLM-suggested field openers

## [0.5.59] - 2026-05-26

1 commit since v0.5.58.

### Fixed
- Fixed excessive scanning time in form configuration direct-fallback mode

## [0.5.58] - 2026-05-26

1 commit since v0.5.57.

### Fixed
- Form configuration now correctly handles missing values in widgets during retry attempts

## [0.5.57] - 2026-05-26

2 commits since v0.5.56.

### Changed
- Display version information in the app header and debug API for preview and production environments

## [0.5.56] - 2026-05-26

1 commit since v0.5.55.

### Fixed
- Scraper screenshots are now properly mounted and accessible in production app and worker containers

## [0.5.55] - 2026-05-26

2 commits since v0.5.54.

### Added
- Debug API endpoint to retrieve scraper screenshots with debug-key authentication
- Screenshot capture and storage for scraper debug runs

## [0.5.54] - 2026-05-26

2 commits since v0.5.53.

### Changed
- Admin: search_page_url is now editable on the job platform detail page

## [0.5.53] - 2026-05-26

1 commits since v0.5.52.

### Added
- Settings import and export functionality

### Changed
- Refactored export endpoint from /export to /data

## [0.5.52] - 2026-05-25

4 commits since v0.5.51.

### Added
- Scraper automatically solves Cloudflare Turnstile "Verify you are human" challenges

### Fixed
- Auto-save no longer creates feedback loops from internal property reads
- Fallback-applied filters no longer incorrectly marked as unsupported
- Scraper improved to prefer exact-name matches when resolving filters

## [0.5.51] - 2026-05-25

1 commit since v0.5.50.

### Fixed
- Chrome process now automatically respawns if it exits unexpectedly

## [0.5.50] - 2026-05-25

9 commits since v0.5.49.

### Added
- Manual browser button and entrypoint for opening pages
- Auto-selection of latest credentials when adding tasks
- Optional platform_id filtering for suggestions with new suggest-task npm script
- LLM opener fallback in search form when chip-label heuristic misses

## [0.5.49] - 2026-05-25

2 commits since v0.5.48.

### Fixed
- Recorder no longer falsely records values as missing for unsupported filters or heuristic-applied values

## [0.5.48] - 2026-05-25

3 commits since v0.5.47.

### Changed
- Job type filter split into separate hours commitment and employment type filters for more granular search control

### Fixed
- Search form now waits for network idle after filter option clicks to improve stability

## [0.5.47] - 2026-05-24

2 commits since v0.5.46.

### Fixed

- Scraper now falls back to the oldest api_key when no tunnel device is connected
- Stealth mode now recovers from Proxy-timeout errors on type-focus clicks

## [0.5.46] - 2026-05-24

1 commit since v0.5.45.

### Changed
- Improved realism of stealth mode by positioning input field clicks toward the center

## [0.5.45] - 2026-05-24

1 commit since v0.5.44.

### Fixed
- Search form now correctly handles Tab key submission without dismissing autocomplete suggestions

## [0.5.44] - 2026-05-24

3 commits since v0.5.43.

### Changed
- Import suggester: keywords now default to lowercase

## [0.5.43] - 2026-05-24

1 commit since v0.5.42.

### Changed
- Debug screenshot capture now uses X11 (scrot) instead of Chrome's CDP queue

## [0.5.42] - 2026-05-24

3 commits since v0.5.41.

### Changed
- Test suite runs in one-shot mode without waiting for input
- sjs-browser watchdog now handles beta channel updates consistently with bootstrap
- sjs-browser reverted persistent CDP WebSocket connections while maintaining /json dedup optimization

## [0.5.41] - 2026-05-24

1 commit since v0.5.40.

### Added
- Tag-based beta channel — Docker images are now tagged with both `:latest` and `:beta` for easy beta testing

## [0.5.40] - 2026-05-24

1 commit since v0.5.39.

### Changed
- Faster release builds by skipping Docker image rebuilds when sources haven't changed

## [0.5.39] - 2026-05-24

2 commits since v0.5.38.

### Fixed
- Fixed search_page_url backfill migration ordering to execute in correct sequence

## [0.5.38] - 2026-05-24

12 commits since v0.5.37.

### Added
- Theme auto-mode syncs with OS theme changes
- Scraper-agent accepts tasks driven by platform search_page_url
- Profile filter in scraper-agent admin create form
- Beta channel for sjs-browser bootstrap auto-updates

### Changed
- Task detail logs wrap long messages to their own line on mobile with row dividers
- Scraper-agent default system prompt refreshed for current scraper state
- Search-form text-fallback parity and improved keyword matching
- Scraper uses persistent CDP WebSocket connection through sjs-browser sessions

### Fixed
- Scraper-agent admin list now correctly orders iterations
- Search-form scraper click-target selection improved
- Desktop scraper retries on Patchright CDP assertion crashes

### Removed
- PLATFORM_FILTER_CARDINALITY override

## [0.5.37] - 2026-05-23

79 commits since v0.5.36.

### Added
- Task auto-save with undo functionality (replaces manual Save/Cancel)
- Experience level filter for job search
- Location URL and timezone fields in profile editor
- Upwork "expert" alias and single-cardinality filter support
- Server-side filter computation in suggest flow to prevent duplicates
- Direct-apply chip filters (radio/checkbox support)

### Changed
- Task URLs display as read-only in task detail (removed inline editing)
- Suggest flow navigates to new tasks on accept instead of appending
- Suggest task notes now show role/title instead of match explanation
- Profile lists ordered by sort field then start date
- Search form now uses dynamic form-fill instead of URL-template synthesis
- Search filters: split category and value aliases for clarity
- Scraper now records unsupported filters instead of observed filters
- Theme Switcher spacing improved in inline variant
- Interview prep category pills more visually distinctive

### Fixed
- Task runs no longer blocked when only platform_id is available
- Upwork search context handling in filter interactions
- CDP key-press race condition in tunnel text input
- Login flow CDP reconnection on humanType focus miss
- humanType diagnostic crash on missing __name variable
- LinkedIn password field focus miss recovery
- AchievementsList svelte:window component placement
- Full-time filter misclick option scoping
- Import tasks duplicate key handling
- Search-form filter option scoping and click-to-expand detection robustness

### Removed
- Manual Save/Cancel buttons from task editor
- Inline URL editing capability from task detail
- Login-URL detection logic (now uses platform.search_page_url)
- Per-platform observed-filters signal (replaced with unsupported-filters)

## [0.5.36] - 2026-05-12

2 commits since v0.5.35.

### Fixed
- Make database migration 0027 (Directus) idempotent to ensure safe re-application

## [0.5.35] - 2026-05-12

2 commits since v0.5.34.

### Fixed
- Fixed six pre-existing Drizzle-flavored type errors

## [0.5.34] - 2026-05-12

50 commits since v0.5.33.

### Added
- Platform Discovery: Admin feature to discover and configure platforms before running jobs, with login and cancellation support
- Preset-driven job picker: Two-step flow (select platform → pick preset) replaces manual URL entry; includes custom URL option for any platform
- Multi-select and structured filters in picker: Filter by sort_by, time_posted, work_location, job_type with multi-select support on matching platforms
- Reusable Collapsible component for advanced filters with improved UX

### Changed
- Discovery start flow moved to platform edit page
- Job picker URL workflow: read-only display with edit toggle, per-field Save/Cancel buttons
- Per-platform search presets now use curated multi-URL pools instead of single template
- Add-task form simplified with two-step platform/preset picker
- Admin menu now includes link to Platform Discovery

### Fixed
- Zod dual-package issue in worker discovery
- Under-configured suggestion-accept tasks
- Platform discovery run cancellation flow
- Configure-credentials link visibility in discovery UI

### Removed
- Legacy Directus tables from schema

## [0.5.33] - 2026-05-10

18 commits since v0.5.32.

### Added
- Job Platforms admin section with platform list, edit pages, and complete audit history
- Job Platforms navigation entry in the Admin sidebar
- 7 new vetted platforms expanded in the suggestion pool and curated collection
- "Preview results" link on each suggestion card for immediate job search feedback
- Activation-funnel event tracking and platform usage analytics to Umami
- Platform signal collection (Phase 1) recorded on task import completion
- Profile-aware AI suggestions tailored to first import tasks
- "Try a sample search" feature with Cloud as the default platform option
- Enhanced stealth mode — re-evaluate tracking on frame navigation events

### Changed
- Job platform suggestion list now uses database-driven configuration for easier curation
- Admin job-platforms list displays clickable platform names for direct editing
- AI chat automatically backfills and populates collected_data on first use and during profile creation
- Expanded AGENTS.md documentation for collected_data flow in AI features

### Fixed
- SSR rendering and stale-state warnings on /home?created=true redirects
- First-impression UX issues from preview audit
- Release script robustness for interrupted releases and registry cleanup

## [0.5.32] - 2026-05-09

3 commits since v0.5.31.

### Added
- Display matched skills in job import view
- Identify logged-in users in analytics

## [0.5.31] - 2026-05-08

1 commit since v0.5.30.

### Changed
- Tunnel relay APIs now resolve shared devices using the preferred device selection method

## [0.5.30] - 2026-05-08

1 commit since v0.5.29.

### Fixed

- Scraper now automatically selects a shared device when a task has no pinned device assigned

## [0.5.29] - 2026-05-08

3 commits since v0.5.28.

### Changed

- Improved humanType task detection with polling and retry mechanism for better accuracy
- Enhanced database migration error handling during deployments with drizzle-orm migrator

## [0.5.28] - 2026-05-08

4 commits since v0.5.27.

### Added
- Bootstrap auto-update feature for sjs-browser with automatic watchdog monitoring
- Devices UI now mentions bootstrap auto-update capability

### Changed
- Build-version environment variables renamed
- Minisign installation now uses upstream binaries instead of package manager

## [0.5.27] - 2026-05-08

7 commits since v0.5.26.

### Added
- Cryptographic signing for sjs-browser releases

### Changed
- Match scores now trigger immediately upon import, appearing within seconds
- Rebranded release artifacts from tunnel-client to sjs-browser

## [0.5.26] - 2026-05-06

3 commits since v0.5.25.

### Fixed
- Tunnel IPC no longer corrupts envelope types during response routing
- Login error handling now properly surfaces automation failures

### Changed
- Tunnel now uses coordinate-based clicking for improved site compatibility
- Terms of Service classifier has been refined for better accuracy

## [0.5.25] - 2026-05-05

1 commit since v0.5.24.

### Added
- Debug run API now exposes `stripped_html` field for search tasks

## [0.5.24] - 2026-05-05

2 commits since v0.5.23.

### Fixed
- LLM output-validation failures in scraper are now treated as non-fatal, improving resilience when processing task data with Groq and other LLM providers

## [0.5.23] - 2026-05-05

7 commits since v0.5.22.

### Fixed
- Drizzle `date()` columns no longer wrapped in `new Date()` — fixes silent type/data mismatches in profile forms (education, side projects, work experience), application tracking, and job-import endpoints
- ProfileDisplay now handles nullable strings and `unknown` jsonb values from Drizzle without crashing
- Various queryRaw call sites returning correct array types
- Schema circular-ref between profiles ↔ profile_versions resolved via explicit `PgTableExtraConfigValue[]` annotation

### Internal
- svelte-check error count: 603 → 51 errors (multi-pass cleanup across types, queryRaw, schema/template alignment, Buffer/Icon/Sidebar imports)
- `getEnv()` now uses TS overloads to narrow return type by call shape
- ioredis import simplified (dropped obsolete CommonJS-ESM compat shim)

## [0.5.22] - 2026-05-03

1 commit since v0.5.21.

### Changed
- Middle-click interactions now route through tunnel for better OS-level focus handling, with Playwright fallback

## [0.5.21] - 2026-05-03

5 commits since v0.5.20.

### Added
- Credential password editing

### Fixed
- Multi-credential support and related test failures
- Tunnel mode focus handling with xdotool for proper OS focus routing

### Changed
- Device-connection widget styling with green status icon and Connected pill indicator

## [0.5.20] - 2026-05-03

1 commit since v0.5.19.

### Fixed
- Fixed 0011 journal migration to properly handle timestamps above 0010

## [0.5.19] - 2026-05-03

3 commits since v0.5.18.

### Changed
- Dashboard now restricts top matches to those scoring 70 or higher

## [0.5.18] - 2026-05-03

13 commits since v0.5.17.

### Added
- Full job details on imported job rows
- Tunnel device picker in new-task form
- Contact-shared credentials in new-task form
- Source URLs on skipped/error import items
- Scraper captures detail-page URLs for skipped/error run items

### Changed
- Improved handling of slow multi-step logins with post-username polling

### Fixed
- Profile export: corrected education relation naming
- Pagination button search scoping in containers

## [0.5.17] - 2026-05-02

1 commit since v0.5.16.

### Fixed
- Verification emails now correctly match to runs using the same credential

## [0.5.16] - 2026-05-02

1 commit since v0.5.15.

### Fixed

- Scraper now includes platform_profile_id when loading search tasks

## [0.5.15] - 2026-05-02

2 commits since v0.5.14.

### Added
- Unit tests for credential and device coupling

### Fixed
- Credential save for contacts

### Changed
- Consolidated credential save buttons

## [0.5.14] - 2026-05-02

21 commits since v0.5.13.

### Added
- Credential sharing feature: users can share individual credentials with other accounts via a share modal with visual badges to indicate shared credentials
- Credential-shares service with backend schema, API endpoints, and validation rules
- Unit tests for credential-shares service
- Backend support for platform_profile_id in search_tasks

### Changed
- Centralized preferred-device rule for tunnel status
- Hardened share-cascade error handling for credential shares

### Fixed
- Restricted credential-share listing to owner (access control)
- Fixed "My device" button not highlighting when selected
- Fixed device-share notification links to point to /jobs/import/devices

## [0.5.13] - 2026-05-02

13 commits since v0.5.12.

**Added**
- `trigger-run` CLI command for queueing scrapes without authentication

**Changed**
- Improved scraper robustness with better click recovery and page state handling
- Optimized page recovery by remapping titles instead of full reload
- Enhanced click handler with button parameters and improved strategy dispatch
- Refactored to use Playwright exclusively for middle-click operations
- Rebased production environment to use preview encryption keypair

**Fixed**
- Fixed platform detection for country-code subdomains
- Fixed crash on page 2 with improved recovery handling
- Fixed navigation preference in search results

## [0.5.12] - 2026-05-01

3 commits since v0.5.11.

### Added
- Show devices shared with you on the /jobs/import/devices page

### Fixed
- Fixed preview environment credentials encryption

## [0.5.11] - 2026-05-01

1 commit since v0.5.10.

### Changed
- Increased request body size limit to 10M for deployed environments

## [0.5.10] - 2026-05-01

7 commits since v0.5.9.

### Changed
- Tunnel operations now support device pinning for screencast, VNC, and keyboard input
- Improved tunnel UI with better browser-view integration for search-task operations
- Input operations (type/clear/submit) now use OS-level keystrokes for better reliability
- Text input and URL navigation now route through the scraper for consistent behavior
- Worker now properly handles dashboard pending actions during intervention

## [0.5.9] - 2026-04-29

3 commits since v0.5.8.

### Added
- New `/api/debug/queue` endpoint and `debug-queue` script for inspecting task queue and run state

### Fixed
- Release cleanup no longer fails when no old images match the filter

## [0.5.8] - 2026-04-27

1 commit since v0.5.7.

### Fixed
- Fixed deployment cleanup failing when no old container images match

## [0.5.7] - 2026-04-27

12 commits since v0.5.6.

### Added
- Rich text editor with bubble menu for inline formatting in letters
- Password change option in account settings
- Linkify utility for notes

### Changed
- Letter content now uses full-featured Tiptap markdown editor instead of plain textarea
- Letter editor always displayed but read-only by default
- Email digest job titles link to Smart Job Seeker detail pages
- "Cheat Sheet" renamed to "Interview Cheat Sheet"
- "AI generated" renamed to "AI assisted"
- Application status system and notes interface redesigned

### Removed
- Follow-up and thank-you letter types

### Fixed
- Editor layout and spacing in read-only mode

## [0.5.6] - 2026-04-26

3 commits since v0.5.5.

### Changed
- Browser provider configuration option renamed from 'local' to 'tunnel' for clarity

### Fixed
- Fixed Glitchtip debug script query: corrected org slug, sorting, and filtering

## [0.5.5] - 2026-04-26

4 commits since v0.5.4.

### Added
- Debug API endpoint and infrastructure for inspecting remote scraper runs
- BuildKit cache cleanup in release and deploy scripts

### Fixed
- Desktop scraper now retries on startup crash (up to 3 attempts)

## [0.5.4] - 2026-04-25

2 commits since v0.5.3.

### Fixed
- Worker now respects user profile timezone with proper fallback cascade

## [0.5.3] - 2026-04-25

5 commits since v0.5.2.

### Changed
- Dashboard home sections reordered with restyled import tasks and updated configuration headings
- Docker builds now use BuildKit with --pull flag for improved performance and cache freshness

### Fixed
- Fixed billing page overlay path following route restructuring

## [0.5.2] - 2026-04-25

17 commits since v0.5.1.

### Added
- Encrypt platform credentials at rest with SJS_CREDENTIALS_KEY environment variable
- Configurable time format (12h/24h) with automatic timezone detection
- Cheat sheet type for workbench

### Changed
- Renamed "letters" to "texts" throughout the application
- Renamed "Import Config" to "Job Import" and "Import Jobs" to "Import Tasks"
- Restructured application and job detail pages with improved styling
- Redesigned job import interface with status pills and improved spacing
- Enhanced dashboard layout and timeline presentation

### Fixed
- Improved scraper validation and data quality
- Simplified scraper stop reason messages

### Removed
- Reasoning field from job details and scraper matcher

## [0.5.1] - 2026-04-24

### Added
- Live clock display in settings page

### Fixed
- Timezone display on scheduling pages

## [0.5.0] - 2026-04-24

### Changed
- Removed `/dashboard` prefix from all app routes for cleaner URLs
- Renamed "API Key" to "Device Key" throughout the UI and error messages
- Devices tab now uses a desktop icon

### Fixed
- Resume version `?version` query param now works for logged-in profile owners
- Public access checkboxes on resume version page now update correctly after saving
- Feedback page 500 error (Prisma-to-Drizzle migration leftover)
- Feedback file attachments not rendering (wrong relation name)

## [0.4.113] - 2026-04-24

4 commits since v0.4.112.

### Changed
- Improved import section icons, labels, and date formatting
- Refactored scraper to use forked child processes for more robust job cancellation

### Fixed
- Fixed scraper stop operations getting stuck

## [0.4.112] - 2026-04-23

1 commit since v0.4.111.

### Changed
- Worker container now receives email environment variables for proper email configuration

## [0.4.111] - 2026-04-23

1 commit since v0.4.110.

### Added
- Deploy script: interactive deployment picker, ~N syntax support, and improved Docker cleanup

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
