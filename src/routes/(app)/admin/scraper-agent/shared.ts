/**
 * Shared types, constants, and utility functions for the Scraper Agent admin pages.
 */

export interface SearchTask {
  id: number;
  note: string | null;
  profileName: string | null;
  platformName: string | null;
  browserProvider: string | null;
  userId: string | null;
  userName: string | null;
}

export interface User {
  id: string;
  name: string;
}

export interface SessionSummary {
  id: number;
  searchTaskId: number;
  searchTaskName: string;
  status: string;
  goal: string;
  maxIterations: number;
  currentIteration: number;
  latestStage: string | null;
  latestSuccessPct: number | null;
  latestRunId: number | null;
  latestRunStatus: string | null;
  latestGoalMet: boolean | null;
  blockedMessage: string | null;
  systemPrompt: string | null;
  runFirst: boolean;
  pendingHint: string | null;
  needsInput: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
}

export interface SessionDetail {
  id: number;
  searchTaskId: number;
  searchTaskName: string;
  status: string;
  goal: string;
  maxIterations: number;
  currentIteration: number;
  runFirst: boolean;
  pendingHint: string | null;
  needsInput: string | null;
  blockedMessage: string | null;
  claudeSessionId: string | null;
  systemPrompt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
}

export interface Iteration {
  id: number;
  iteration: number;
  stage: string | null;
  runId: number | null;
  runStatus: string | null;
  itemsTotal: number | null;
  itemsCompleted: number | null;
  itemsError: number | null;
  successPct: number | null;
  goalMet: boolean | null;
  goalEvaluation: string | null;
  prompt: string | null;
  claudeAnalysis: string | null;
  claudeChanges: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export const DEFAULT_SYSTEM_PROMPT = `You are improving a generic job scraper that must work across many job sites (LinkedIn, Indeed, Glassdoor, Upwork, niche boards) without site-specific code branches.

Generic-first principles:
- Detection runs through patterns in scraper-patterns.json, LLM extraction, and accessibility-tree heuristics — not CSS selectors targeting a specific site's DOM.
- Tactics must work across many sites and languages (EN, ES, DE, FR, NL, PT). A fix that helps one site must not break others — guard new logic so it only activates when relevant conditions are met.
- When extraction fails, fix the general case, not the specific page. Ask: "Would this change work on a site I've never seen?"
- The scraper already handles pagination, cookie/overlay dismissal, login flows, SPA navigation, content revelation (expand/tabs), challenge detection (Cloudflare, CAPTCHA), and page degradation recovery.

Per-platform config (use sparingly):
- The job_platforms table carries the only allowed per-site state: login_page_url, search_page_url, and an unsupported_filters jsonb the search-form flow writes to when a requested filter isn't on the form.
- Before adding anything platform-keyed, ask whether a generic pattern (in scraper-patterns.json or detected at runtime) would solve it. Manual per-site configs rot when sites change.
- If a per-site signal feels unavoidable, prefer caching observed structure (keyed by platform, with a generic fallback on cache miss/staleness) over a hardcoded branch.

Click model:
- Tunnel mode (primary on user-owned browsers) issues OS-level clicks via xdotool through the desktop app — real X11 events with isTrusted=true on viewport coordinates. See humanClickElement / humanMiddleClick in browser/stealth-utils.ts. This is what survives LinkedIn-grade automation detection.
- Non-tunnel mode falls back to Playwright/CDP mouse events with curved motion paths.
- Tunnel mode skips humanWait() because tunnel latency provides natural pacing — don't reintroduce sleeps that would slow tunnel runs.

Search form:
- The scraper configures the search itself on the platform's search page, not via a pre-baked URL. configureSearchViaForm (scrapers/search-form/) navigates to search_page_url, identifies form widgets via LLM + accessibility tree, fills search_term/search_location, and applies search_filters from the task.
- Filters the form doesn't expose are recorded on job_platforms.unsupported_filters so the suggest endpoint can deprioritize incompatible platforms. Don't silently drop unsupported filters.

Debugging:
- All structured logs are stored per-run (scraper_logs) and shown to you in the next iteration. When the root cause isn't clear, add debug logging to capture intermediate state.
- For visual context, ask the user to enable search_tasks.debug_screenshots. With it on, the scraper snapshots the page after each click/type/scroll; the path lands on scraper_logs.screenshot_path and is surfaced alongside the log in iteration data.
- Clean up overly verbose debug logging once resolved; general-purpose debug logging that aids future troubleshooting is fine to keep.

Asking for help:
- If you're stuck (same errors repeating, unclear site behavior, need domain knowledge, want screenshots enabled), request human input by including this block in your response:
=== NEEDS_INPUT ===
Your question here — what do you need to know?
=== END_NEEDS_INPUT ===
This pauses the session for the developer. Use only when you genuinely can't figure it out.

Focus areas when analyzing logs:
- Items with status "error" — what failed during click, extraction, or navigation?
- LLM extraction quality — are jobs being parsed correctly?
- Pagination — is the scraper finding and clicking next?
- Click handling — are job cards opening (new tab, SPA, modal)?
- Content revelation — is the full description being captured?
- Search-form config — did keywords/location/filters apply? Any false unsupported flags?`;

export function isActive(status: string): boolean {
  return ["active", "paused"].includes(status);
}

export function statusColor(status: string): string {
  switch (status) {
    case "active": return "text-green-600";
    case "paused": return "text-amber-600";
    case "completed": return "text-[var(--dash-primary)]";
    case "failed": return "text-[var(--dash-error)]";
    case "cancelled": return "text-[var(--dash-text-muted)]";
    default: return "text-[var(--dash-text-secondary)]";
  }
}

export function statusDot(status: string): string {
  switch (status) {
    case "active": return "bg-green-500";
    case "paused": return "bg-amber-500";
    case "completed": return "bg-[var(--dash-primary)]";
    case "failed": return "bg-[var(--dash-error)]";
    case "cancelled": return "bg-gray-400";
    default: return "bg-gray-400";
  }
}

export function formatTime(date: string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function stageLabel(stage: string | null): string {
  switch (stage) {
    case "claude": return "AI analyzing & coding";
    case "reloading": return "Worker reloading";
    case "scraping": return "Running scrape";
    case "blocked": return "Waiting for manual action";
    case "evaluating": return "Evaluating results";
    case "done": return "Done";
    case "error": return "Error";
    default: return "Starting...";
  }
}

export function stageColor(stage: string | null): string {
  switch (stage) {
    case "claude": return "text-purple-600";
    case "reloading": return "text-amber-500";
    case "scraping": return "text-blue-600";
    case "blocked": return "text-orange-600";
    case "evaluating": return "text-cyan-600";
    case "done": return "text-green-600";
    case "error": return "text-[var(--dash-error)]";
    default: return "text-[var(--dash-text-muted)]";
  }
}

export function progressPct(session: { currentIteration: number; maxIterations: number }): number {
  return session.maxIterations > 0
    ? (session.currentIteration / session.maxIterations) * 100
    : 0;
}
