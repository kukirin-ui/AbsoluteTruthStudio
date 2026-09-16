/**
 * Mounts this app's Better Auth instance at /api/auth/* — the catch-all every
 * auth request hits: get-session, sign-in/email, sign-up/email,
 * oauth2/authorize, oauth2/callback/<providerId>, sign-out, etc.
 *
 * This file was missing entirely. Without it, `auth` in `src/lib/auth/server.ts`
 * is a fully configured Better Auth instance that is never wired to an HTTP
 * route — every request the client makes to `/api/auth/*` 404s, so NOTHING
 * related to sign-in works (not Google/X, not email/password), independent of
 * VITE_AUTH_ENABLED, DATABASE_URL, or the broker/social provider config.
 *
 * `$` is a TanStack Router splat segment — it matches the entire remainder of
 * the path under /api/auth/, which Better Auth's own router needs to
 * distinguish all of its sub-routes.
 */
import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: ({ request }) => auth.handler(request),
    },
  },
});
