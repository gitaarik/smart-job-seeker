// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Session, User } from "$lib/server/auth/better-auth";

declare global {
  interface Window {
    umami: object;
    turnstile: {
      render: (container: HTMLElement, options: object) => void;
      reset: (container: HTMLElement) => void;
      remove: (container: HTMLElement) => void;
    };
  }
  namespace App {
    // interface Error {}
    interface Locals {
      user: User | null;
      session: Session | null;
      adminUser: User | null;
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
