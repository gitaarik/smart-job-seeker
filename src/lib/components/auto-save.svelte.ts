import { untrack } from "svelte";

/**
 * Auto-save state machine for a single form field (or group of fields treated
 * as one). Replaces the manual "show Save/Cancel when dirty" pattern with
 * "save immediately, offer Undo briefly".
 *
 * Usage:
 *   const note = autoSaveField({
 *     initial: searchTask.note,
 *     save: (v) => patchSearchTask({ note: v }),
 *     onSaved: (v) => { searchTask.note = v },
 *     debounceMs: 700,
 *   });
 *
 *   <input bind:value={note.value} onblur={note.flush} />
 *   <AutoSaveIndicator field={note} />
 *
 * Behavior:
 *  - set(v) updates the local value and schedules a save after debounceMs.
 *  - Concurrent saves are serialized by sequence id; older results are
 *    discarded when a newer save starts (latest write wins).
 *  - On success, status flashes "saved" for a few seconds and undo() is
 *    available — undo posts the previous saved value through the same save fn.
 *  - On failure, the user's value stays put (no snap-back) and retry() re-runs
 *    the save. The next set() also clears the error.
 */

export type AutoSaveStatus = "idle" | "saving" | "saved" | "error";

export interface AutoSaveOptions<T> {
  /** Value that's currently persisted on the server. */
  initial: T;
  /** Persists a value. Must throw on failure (message is shown to the user). */
  save: (value: T) => Promise<void>;
  /** Called after every successful save (including undo) so the caller can
   *  sync mirrors like `searchTask.note = v`. */
  onSaved?: (value: T) => void;
  /** Custom equality for deciding whether `set` is a real change. Default
   *  is Object.is. Text fields usually want `(a,b) => (a??'').trim() === (b??'').trim()`. */
  equal?: (a: T, b: T) => boolean;
  /** Wait this long after the most recent set() before saving. Default 0
   *  (save immediately on change). Use ~700ms for free-text inputs. */
  debounceMs?: number;
  /** How long to keep the "Saved · Undo" state visible after a successful
   *  save before fading to idle. Default 5000ms. */
  savedFlashMs?: number;
}

export interface AutoSaveField<T> {
  /** Current value (may be ahead of `saved` while typing or saving). */
  readonly value: T;
  /** Last value confirmed by the server. */
  readonly saved: T;
  /** True while a save is pending (debounce) or in flight. */
  readonly dirty: boolean;
  readonly status: AutoSaveStatus;
  /** Last error message, cleared on the next set/retry. */
  readonly error: string | null;
  /** True for the savedFlashMs window after a successful save, while a
   *  previous value is still recoverable. */
  readonly canUndo: boolean;
  /** Update the value and schedule a save. */
  set: (value: T) => void;
  /** Force the debounced save to run now (call on blur for text inputs). */
  flush: () => void;
  /** Retry after an error without requiring the user to re-enter the value. */
  retry: () => void;
  /** Revert to the value saved before the most recent save. */
  undo: () => void;
  /** Re-seed both `value` and `saved` to a new initial (use from the parent's
   *  navigation/reset path). Cancels any pending save and clears state. */
  reset: (newInitial: T) => void;
  /** Tear down timers. Call from onDestroy if the field outlives its UI. */
  destroy: () => void;
}

export function autoSaveField<T>(opts: AutoSaveOptions<T>): AutoSaveField<T> {
  const equal = opts.equal ?? Object.is;
  const debounceMs = opts.debounceMs ?? 0;
  const savedFlashMs = opts.savedFlashMs ?? 5000;

  let value = $state<T>(opts.initial);
  let saved = $state<T>(opts.initial);
  let previousSaved = $state<T>(opts.initial);
  let status = $state<AutoSaveStatus>("idle");
  let error = $state<string | null>(null);
  let canUndo = $state(false);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let flashTimer: ReturnType<typeof setTimeout> | null = null;
  let latestSeq = 0;

  const dirty = $derived(!equal(value, saved));

  function clearDebounce() {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  }

  function clearFlash() {
    if (flashTimer !== null) {
      clearTimeout(flashTimer);
      flashTimer = null;
    }
  }

  function scheduleSave() {
    clearDebounce();
    if (debounceMs > 0) {
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        void runSave();
      }, debounceMs);
    } else {
      void runSave();
    }
  }

  async function runSave() {
    // Reads of `value`/`saved` inside this function may run synchronously
    // inside a caller's $effect (via set → scheduleSave → runSave when
    // debounceMs=0). We untrack them so the caller doesn't depend on our
    // internal state — otherwise our own writes (value=…, saved=…) would
    // re-fire the calling effect.
    if (untrack(() => equal(value, saved))) return;
    const seq = ++latestSeq;
    status = "saving";
    error = null;
    // Clear the "Saved · Undo" pill from a prior cycle — a fresh save means a
    // fresh undo target once this one completes.
    canUndo = false;
    clearFlash();
    const sending = untrack(() => value);
    const rollback = untrack(() => saved);
    try {
      await opts.save(sending);
      if (seq !== latestSeq) return; // a newer save superseded us
      previousSaved = rollback;
      saved = sending;
      opts.onSaved?.(sending);
      status = "saved";
      canUndo = true;
      flashTimer = setTimeout(() => {
        flashTimer = null;
        if (status === "saved") status = "idle";
      }, savedFlashMs);
      // If the user changed the value while this save was in flight, run
      // again so the server catches up to what's on screen.
      if (!equal(value, saved)) scheduleSave();
    } catch (err) {
      if (seq !== latestSeq) return;
      error = err instanceof Error ? err.message : "Save failed";
      status = "error";
    }
  }

  return {
    get value() {
      return value;
    },
    get saved() {
      return saved;
    },
    get dirty() {
      return dirty;
    },
    get status() {
      return status;
    },
    get error() {
      return error;
    },
    get canUndo() {
      return canUndo;
    },
    set(v: T) {
      // untrack the equality reads so a caller inside an $effect doesn't
      // depend on our internal `value`/`saved` — otherwise our own writes
      // here would re-fire the effect (and for object T, `value = v` always
      // looks like a change because it's a new proxy reference).
      if (untrack(() => equal(v, value))) return;
      value = v;
      error = null;
      if (untrack(() => equal(v, saved))) {
        // Snapped back to the saved value (e.g. user retyped the original).
        // Drop any pending save; leave a lingering "saved" flash alone.
        clearDebounce();
        return;
      }
      scheduleSave();
    },
    flush() {
      if (debounceTimer !== null) {
        clearDebounce();
        void runSave();
      }
    },
    retry() {
      if (!untrack(() => equal(value, saved))) void runSave();
    },
    undo() {
      if (!canUndo) return;
      // Bump the seq so any in-flight saved-flash teardown is a no-op, then
      // post the previous value back through the same save fn.
      const target = previousSaved;
      value = target;
      // Treat undo as immediate — debounce makes no sense for a deliberate action.
      clearDebounce();
      void runSave();
    },
    reset(newInitial: T) {
      clearDebounce();
      clearFlash();
      latestSeq++; // invalidate any in-flight save's commit step
      value = newInitial;
      saved = newInitial;
      previousSaved = newInitial;
      status = "idle";
      error = null;
      canUndo = false;
    },
    destroy() {
      clearDebounce();
      clearFlash();
      latestSeq++;
    },
  };
}
