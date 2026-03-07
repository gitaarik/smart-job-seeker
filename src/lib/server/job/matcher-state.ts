/**
 * Matcher State - Shared state between worker and app via Redis
 *
 * The worker writes matcher state (currently processing job, cycle info)
 * and the app reads it to display progress in the dashboard.
 *
 * NOTE: Uses relative imports so this works from both SvelteKit ($lib) and the worker.
 */

import { getRedisClient } from "../queue/redis.js";

const MATCHER_STATE_KEY = "matcher:state";
const MATCHER_STATE_TTL = 120; // seconds — auto-expire if worker dies

export interface MatcherState {
  /** Whether the matcher loop is actively running */
  active: boolean;
  /** Profile ID being matched */
  profileId: number | null;
  /** Currently processing job ID (null if idle between cycles) */
  currentJobId: number | null;
  /** Currently processing job title */
  currentJobTitle: string | null;
  /** Number of jobs processed in the current cycle */
  cycleProcessed: number;
  /** Total jobs in the current cycle batch */
  cycleBatchSize: number;
  /** Total cycles completed */
  totalCycles: number;
  /** Total jobs matched across all cycles */
  totalMatched: number;
  /** Total jobs failed across all cycles */
  totalFailed: number;
  /** Timestamp of last update */
  lastUpdated: string;
}

/**
 * Write matcher state to Redis (called from worker)
 */
export async function setMatcherState(state: MatcherState): Promise<void> {
  const redis = getRedisClient();
  await redis.set(MATCHER_STATE_KEY, JSON.stringify(state), "EX", MATCHER_STATE_TTL);
}

/**
 * Read matcher state from Redis (called from app API)
 */
export async function getMatcherState(): Promise<MatcherState | null> {
  const redis = getRedisClient();
  const data = await redis.get(MATCHER_STATE_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data) as MatcherState;
  } catch {
    return null;
  }
}

/**
 * Clear matcher state (called on worker shutdown)
 */
export async function clearMatcherState(): Promise<void> {
  const redis = getRedisClient();
  await redis.del(MATCHER_STATE_KEY);
}
