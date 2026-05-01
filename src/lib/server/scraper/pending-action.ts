/**
 * Submit a pending action to a running scrape and wait for the scraper to
 * execute it. The scraper picks up `pending_action` from `search_task_runs`
 * during its intervention wait loop, runs it against the live page, and
 * writes the result back into the same JSONB field.
 *
 * Works for both hosted (GoLogin) and tunnel (local Chrome via relay)
 * since the scraper itself owns the CDP connection.
 */

import { dbDirect as db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { search_task_runs } from "$lib/server/db/schema";

export interface PendingActionRequest {
  type: "type_text" | "navigate_url" | "submit" | "clear";
  text?: string;
  url?: string;
  submit?: boolean;
}

export interface FocusedFieldInfo {
  tag: string;
  id: string | null;
  name: string | null;
  type: string | null;
  value?: string | null;
}

export interface PendingActionResult {
  success: boolean;
  message: string;
  page?: { url: string };
  focused?: FocusedFieldInfo | null;
  /** Same shape as `focused`, captured ~500ms later to detect SPAs that clear the field. */
  focusedAfter?: FocusedFieldInfo | null;
}

interface StoredAction extends PendingActionRequest {
  requestId: string;
  requestedAt: string;
  status: "pending" | "completed" | "failed";
  result?: PendingActionResult;
  completedAt?: string;
}

/**
 * Submit a pending action for the scraper to execute and wait (with timeout)
 * for the scraper to write the result back.
 */
export async function submitPendingAction(
  runId: number,
  request: PendingActionRequest,
  { timeoutMs = 15_000, pollIntervalMs = 250 }: {
    timeoutMs?: number;
    pollIntervalMs?: number;
  } = {},
): Promise<PendingActionResult> {
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const action: StoredAction = {
    ...request,
    requestId,
    requestedAt: new Date().toISOString(),
    status: "pending",
  };

  await db.update(search_task_runs)
    .set({ pending_action: action })
    .where(eq(search_task_runs.id, runId));

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollIntervalMs));
    const row = await db.query.search_task_runs.findFirst({
      where: eq(search_task_runs.id, runId),
      columns: { pending_action: true, status: true },
    });
    if (!row) {
      return { success: false, message: "Run disappeared while waiting" };
    }
    if (row.status !== "running" && row.status !== "blocked") {
      return {
        success: false,
        message: `Run is no longer active (status: ${row.status})`,
      };
    }
    const stored = row.pending_action as StoredAction | null;
    if (
      stored &&
      stored.requestId === requestId &&
      (stored.status === "completed" || stored.status === "failed") &&
      stored.result
    ) {
      return stored.result;
    }
  }

  return {
    success: false,
    message: "Timed out waiting for scraper to execute the action",
  };
}
