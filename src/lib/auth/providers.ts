/**
 * The native OAuth providers this app offers for sign-in.
 *
 * Source of truth for BOTH the server (`server.ts`, `socialProviders`) and the
 * client (`client.ts` / sign-in buttons). Kept in its own dependency-free
 * module so the client can import it without pulling the server-only Better
 * Auth instance (and `pg`) into the browser bundle.
 *
 * Each entry needs its own real OAuth app credentials
 * (`<PROVIDER>_CLIENT_ID`/`<PROVIDER>_CLIENT_SECRET`) set for that button to
 * actually work — see `.env.example`. This app holds and uses its own
 * credentials directly; there is no shared broker or third-party identity
 * service in between.
 */
export type AuthProvider = {
  /** Better Auth's id for this provider — also the OAuth callback path segment. */
  providerId: "google" | "github";
  /** Human label for the sign-in button. */
  label: string;
};

export const AUTH_PROVIDERS: readonly AuthProvider[] = [
  { providerId: "google", label: "Google" },
  { providerId: "github", label: "GitHub" },
];
