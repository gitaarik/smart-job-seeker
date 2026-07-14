/**
 * Client-side store backing the inline <TranslatableField> tabs.
 *
 * A single shared `activeLocale` drives every field on the page (switch one to
 * NL → all switch), and one lazy fetch loads the selected profile's overlays.
 * Edits debounce-save to /api/translations independently of each form's own
 * save button. Browser-only: never mutated during SSR.
 */

import { browser } from "$app/environment";
import { BASE_LOCALE, translationKey } from "$lib/resume-translations";

export type TranslationSaveStatus = "idle" | "saving" | "saved" | "error";

interface TranslationRow {
  entity_type: string;
  entity_id: number;
  field: string;
  locale: string;
  value: string;
}

const SAVE_DEBOUNCE_MS = 600;

class TranslationStore {
  /** Language shown across all inline fields; "en" edits the base columns. */
  activeLocale = $state(BASE_LOCALE);
  /** `${entity}:${id}:${field}:${locale}` → translated value. */
  values = $state<Record<string, string>>({});
  /** Per-field save feedback, same key space as `values`. */
  status = $state<Record<string, TranslationSaveStatus>>({});
  loaded = $state(false);

  #loadPromise: Promise<void> | null = null;
  #timers: Record<string, ReturnType<typeof setTimeout>> = {};

  #key(entity: string, id: number, field: string, locale: string): string {
    return `${translationKey(entity, id, field)}:${locale}`;
  }

  /** Fetch the profile's overlays once; subsequent calls reuse the promise. */
  ensureLoaded(): Promise<void> {
    if (!browser || this.loaded) return Promise.resolve();
    if (!this.#loadPromise) {
      this.#loadPromise = (async () => {
        try {
          const res = await fetch("/api/translations");
          if (res.ok) {
            const data = await res.json();
            const map: Record<string, string> = {};
            for (const r of (data.translations ?? []) as TranslationRow[]) {
              map[
                `${translationKey(r.entity_type, r.entity_id, r.field)}:${r.locale}`
              ] = r.value;
            }
            this.values = map;
          }
        } finally {
          this.loaded = true;
        }
      })();
    }
    return this.#loadPromise;
  }

  setActive(locale: string): void {
    this.activeLocale = locale;
  }

  get(entity: string, id: number, field: string, locale = this.activeLocale): string {
    return this.values[this.#key(entity, id, field, locale)] ?? "";
  }

  statusFor(entity: string, id: number, field: string, locale = this.activeLocale): TranslationSaveStatus {
    return this.status[this.#key(entity, id, field, locale)] ?? "idle";
  }

  /** Update a translation locally and schedule a debounced save. */
  edit(entity: string, id: number, field: string, value: string, locale = this.activeLocale): void {
    const k = this.#key(entity, id, field, locale);
    this.values[k] = value;
    if (this.#timers[k]) clearTimeout(this.#timers[k]);
    this.#timers[k] = setTimeout(() => this.#save(entity, id, field, locale), SAVE_DEBOUNCE_MS);
  }

  /** Save immediately (e.g. on blur), cancelling any pending debounce. */
  flush(entity: string, id: number, field: string, locale = this.activeLocale): void {
    const k = this.#key(entity, id, field, locale);
    if (this.#timers[k]) {
      clearTimeout(this.#timers[k]);
      delete this.#timers[k];
      void this.#save(entity, id, field, locale);
    }
  }

  async #save(entity: string, id: number, field: string, locale: string): Promise<void> {
    const k = this.#key(entity, id, field, locale);
    delete this.#timers[k];
    this.status[k] = "saving";
    try {
      const res = await fetch("/api/translations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, id, field, locale, value: this.values[k] ?? "" }),
      });
      this.status[k] = res.ok ? "saved" : "error";
    } catch {
      this.status[k] = "error";
    }
    if (this.status[k] === "saved") {
      setTimeout(() => {
        if (this.status[k] === "saved") this.status[k] = "idle";
      }, 1500);
    }
  }
}

export const translations = new TranslationStore();
