import * as Sentry from "@sentry/sveltekit";

const dsn = import.meta.env.PUBLIC_SENTRY_DSN;

if (dsn) {
  const host = window.location.hostname;
  const environment = host.includes("preview.") ? "preview"
    : host.includes("dev.") ? "development"
    : host.includes("www.") ? "production"
    : "development";

  Sentry.init({
    dsn,
    environment,
    tracesSampleRate: 0,
  });
}

export const handleError = dsn ? Sentry.handleErrorWithSentry() : undefined;
