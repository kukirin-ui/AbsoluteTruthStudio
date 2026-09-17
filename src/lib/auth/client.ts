import { createAuthClient } from "better-auth/react";
import { AUTH_PROVIDERS } from "./providers";

/**
 * Better Auth client for this React SPA (browser-side).
 *
 * Talks to this app's OWN Better Auth at same-origin `/api/auth/*`. Native
 * Google/GitHub OAuth — no broker, no popup dance, no partitioned-iframe bearer
 * token. Plain cookie-based sessions throughout.
 *
 * To sign out call `signOut()` below, NOT `authClient.signOut()` — this app's
 * `signOut()` also redirects afterward; the raw client call does not.
 */
export const authClient = createAuthClient();

/**
 * True when sign-in UI should be shown — i.e. whenever `VITE_AUTH_ENABLED` is
 * not `"false"`. With the key unset (or any value other than `"false"`),
 * sign-in is real, backed by this app's own Postgres-backed sessions.
 */
export const authEnabled = import.meta.env.VITE_AUTH_ENABLED !== "false";

/** The providers to render sign-in buttons for. */
export { AUTH_PROVIDERS };

/**
 * Stub kept only so `middleware.ts`'s dynamic import still resolves. This app
 * has no embedded/partitioned-iframe context that needs a bearer token — every
 * real request here rides the ordinary session cookie — so this always
 * returns null and the bearer path in `middleware.ts`/`server.ts` is inert.
 */
export function getBearerToken(): string | null {
  return null;
}

/**
 * Start sign-in with a native OAuth provider (`providerId` from
 * `AUTH_PROVIDERS`) — a plain redirect into that provider's own login page.
 * After the provider round-trip, Better Auth sends the visitor to
 * `callbackURL` (defaults to the studio home).
 */
export async function signIn(
  providerId: "google" | "github",
  opts: { callbackURL?: string } = {},
): Promise<void> {
  const { data, error } = await authClient.signIn.social({
    provider: providerId,
    callbackURL: opts.callbackURL ?? "/",
  });
  if (error) throw new Error(error.message ?? "Sign-in failed");
  if (data?.url) window.location.href = data.url;
}

/** Google OAuth — always returns the visitor to the studio home. */
export async function signInWithGoogle(): Promise<void> {
  return signIn("google", { callbackURL: "/" });
}

/** GitHub OAuth — always returns the visitor to the studio home. */
export async function signInWithGithub(): Promise<void> {
  return signIn("github", { callbackURL: "/" });
}

/**
 * Sign out of this app's session, then redirect. Session is an HttpOnly
 * cookie only the server can clear — if the server call fails, this throws
 * rather than reporting a sign-out that did not actually happen.
 */
export async function signOut(redirectTo = "/login"): Promise<void> {
  const { error } = await authClient.signOut();
  if (error) throw new Error(error.message ?? "Sign-out failed");
  window.location.href = redirectTo;
}
