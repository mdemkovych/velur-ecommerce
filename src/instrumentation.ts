import type { Instrumentation } from "next";

/**
 * Server instrumentation for unhandled exception monitoring via Sentry.
 *
 * NOTE: (§9.5) Sanitizes error events to scrub PII, IP addresses, cookies, and query tokens before dispatch.
 */

/** NOTE: (§9.5) Validates and returns Sentry DSN configuration for production Node.js runtime. */
function reportingTarget(): string | null {
  if (process.env.NODE_ENV !== "production") return null;
  if (process.env.NEXT_RUNTIME !== "nodejs") return null;

  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return null;

  try {
    new URL(dsn);
    return dsn;
  } catch {
    console.error("SENTRY_DSN is not a valid URL — error reporting stays off");
    return null;
  }
}

export async function register(): Promise<void> {
  const dsn = reportingTarget();
  if (!dsn) return;

  const Sentry = await import("@sentry/node");

  Sentry.init({
    dsn,
    // NOTE: (§2.7, §9.5) Privacy safeguard: suppresses default PII collection and scrubs request metadata.
    sendDefaultPii: false,
    tracesSampleRate: 0,
    environment: "production",
    beforeSend(event) {
      delete event.user;
      delete event.server_name;

      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers;
        delete event.request.data;
        delete event.request.query_string;
      }

      return event;
    },
  });
}

/** NOTE: (§9.5) Captures server request runtime errors with sanitized route execution context. */
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context,
) => {
  if (!reportingTarget()) return;

  const Sentry = await import("@sentry/node");

  Sentry.withScope((scope) => {
    scope.setContext("route", {
      path: context.routePath,
      type: context.routeType,
      kind: context.routerKind,
      method: request.method,
    });
    Sentry.captureException(err);
  });
};

