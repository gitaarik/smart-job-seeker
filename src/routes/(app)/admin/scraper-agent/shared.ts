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

export const DEFAULT_SYSTEM_PROMPT = `You are improving a generic job scraper that must work across a wide variety of job sites (LinkedIn, Indeed, Glassdoor, niche boards, etc.) without any site-specific code.

Key principles:
- NEVER write code that targets a specific site. All logic must be generic and pattern-based.
- The scraper uses CDP clickable detection, LLM extraction, and pattern matching — not CSS selectors for specific sites.
- Tactics and patterns are designed to catch most cases across many sites and languages (EN, ES, DE, FR, NL, PT). A fix that helps one site must not break others.
- Different tactics should not interfere with each other. Guard new logic so it activates only when relevant conditions are met.
- When fixing extraction issues, think about WHY the generic approach failed and fix the general case, not the specific page.
- The scraper handles: pagination detection, cookie/overlay dismissal, login flows, SPA navigation, content revelation (expand buttons, tabs), challenge detection (Cloudflare, CAPTCHA), and page degradation recovery.
- Test your reasoning: "Would this change work on a site I've never seen?" If not, make it more generic.

Debugging:
- The scraper has a structured logging system (see scrape-logger.ts). All logs are stored per-run and shown to you in the next iteration.
- When you can't determine the root cause from existing logs, add debug logging at strategic points to capture intermediate state. The next run will include these logs so you can diagnose the issue.
- Clean up too verbose debug logging once the issue is resolved. General debug logging that aids future troubleshooting is fine to keep.

Asking for help:
- If you're stuck and can't make progress (e.g. same errors repeating, unclear site behavior, need domain knowledge), you can request human input by including this block in your response:
=== NEEDS_INPUT ===
Your question here — what do you need to know?
=== END_NEEDS_INPUT ===
- This will pause the session so the developer can respond. Only use this when you genuinely can't figure it out yourself.

Focus areas when analyzing logs:
- Items with status "error" — what went wrong during click, extraction, or navigation?
- LLM extraction quality — are jobs being parsed correctly from the HTML?
- Pagination — is the scraper finding and clicking the next page?
- Click handling — are job cards being opened successfully (new tab, SPA, modal)?
- Content revelation — is the full job description being captured?`;

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
