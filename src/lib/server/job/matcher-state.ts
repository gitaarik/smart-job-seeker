/**
 * Matcher State - Shared state between worker and app via Redis
 *
 * The worker writes matcher state (currently processing job, cycle info)
 * and the app reads it to display progress in the dashboard.
 *
 * State is stored per-profile so multiple profiles can be tracked independently.
 * A global heartbeat key indicates whether the matcher worker is alive.
 *
 * NOTE: Uses relative imports so this works from both SvelteKit ($lib) and the worker.
 */

import { getRedisClient } from "../queue/redis.js";

const MATCHER_STATE_PREFIX = "matcher:state:";
const MATCHER_STATE_TTL = 120; // seconds — auto-expire if worker dies
const MATCHER_HEARTBEAT_KEY = "matcher:heartbeat";
const MATCHER_HEARTBEAT_TTL = 120; // seconds

export interface MatcherError {
  jobId: number;
  jobTitle: string;
  message: string;
  timestamp: string;
}

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
  /** Recent errors (last 50) */
  recentErrors: MatcherError[];
  /** Timestamp of last update */
  lastUpdated: string;
}

function matcherStateKey(profileId: number): string {
  return `${MATCHER_STATE_PREFIX}${profileId}`;
}

/**
 * Write matcher state to Redis for a specific profile (called from worker)
 */
export async function setMatcherState(
  profileId: number,
  state: MatcherState,
): Promise<void> {
  const redis = getRedisClient();
  await redis.set(
    matcherStateKey(profileId),
    JSON.stringify(state),
    "EX",
    MATCHER_STATE_TTL,
  );
}

/**
 * Read matcher state from Redis for a specific profile (called from app API)
 */
export async function getMatcherState(
  profileId: number,
): Promise<MatcherState | null> {
  const redis = getRedisClient();
  const data = await redis.get(matcherStateKey(profileId));
  if (!data) return null;
  try {
    return JSON.parse(data) as MatcherState;
  } catch {
    return null;
  }
}

/**
 * Clear matcher state for a specific profile
 */
export async function clearMatcherState(profileId: number): Promise<void> {
  const redis = getRedisClient();
  await redis.del(matcherStateKey(profileId));
}

/**
 * Clear all matcher state keys (called on worker shutdown)
 */
export async function clearAllMatcherStates(): Promise<void> {
  const redis = getRedisClient();
  let cursor = "0";
  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      "MATCH",
      `${MATCHER_STATE_PREFIX}*`,
      "COUNT",
      100,
    );
    cursor = nextCursor;
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } while (cursor !== "0");
}

/**
 * Get matcher state for all profiles (for admin dashboard)
 */
export async function getAllMatcherStates(): Promise<MatcherState[]> {
  const redis = getRedisClient();
  const states: MatcherState[] = [];
  let cursor = "0";
  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      "MATCH",
      `${MATCHER_STATE_PREFIX}*`,
      "COUNT",
      100,
    );
    cursor = nextCursor;
    if (keys.length > 0) {
      const values = await redis.mget(...keys);
      for (const val of values) {
        if (val) {
          try {
            states.push(JSON.parse(val) as MatcherState);
          } catch {
            // skip malformed entries
          }
        }
      }
    }
  } while (cursor !== "0");
  return states;
}

/**
 * Update matcher heartbeat (called from worker each cycle to signal liveness)
 */
export async function setMatcherHeartbeat(): Promise<void> {
  const redis = getRedisClient();
  await redis.set(MATCHER_HEARTBEAT_KEY, Date.now().toString(), "EX", MATCHER_HEARTBEAT_TTL);
}

/**
 * Check if the matcher worker is alive (heartbeat within TTL)
 */
export async function isMatcherAlive(): Promise<boolean> {
  const redis = getRedisClient();
  const val = await redis.get(MATCHER_HEARTBEAT_KEY);
  return val !== null;
}
