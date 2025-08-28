// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  interface Window {
    umami: object,
    turnstile: {
      render: (container: HTMLElement, options: object) => void;
      reset: (container: HTMLElement) => void;
      remove: (container: HTMLElement) => void;
    }
  }
  namespace App {
    // interface Error {}
    interface Locals {
      user?: {
        id: string
        email: string
        firstName: string | null
        lastName: string | null
      }
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export { };
