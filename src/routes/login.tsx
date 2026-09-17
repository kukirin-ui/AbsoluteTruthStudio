import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { SiteShell } from "@/components/studio/site-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Sign in · Absolute Truth Studio" }] }),
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<"google" | "github" | null>(null);

  // Already signed in — nothing to do here.
  if (!isPending && user) {
    void navigate({ to: "/" });
    return null;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } =
        mode === "signup"
          ? await authClient.signUp.email({ email, password, name: email.split("@")[0] })
          : await authClient.signIn.email({ email, password });
      if (error) {
        toast.error(error.message ?? "Something went wrong. Try again.");
        return;
      }
      toast.success(mode === "signup" ? "Account created" : "Signed in");
      void navigate({ to: "/" });
    } catch {
      toast.error("Couldn't reach the server. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  async function onOAuth(provider: "google" | "github") {
    setOauthBusy(provider);
    try {
      await signIn(provider, { callbackURL: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed. Try again.");
      setOauthBusy(null);
    }
  }

  const locked = busy || oauthBusy !== null;

  return (
    <SiteShell title="Sign in" kicker="Free to start">
      <div className="mx-auto w-full max-w-sm space-y-6">
        <div className="flex rounded-lg bg-panel p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`flex-1 rounded-md py-1.5 transition ${mode === "signin" ? "bg-indigo text-white" : "text-muted"}`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 rounded-md py-1.5 transition ${mode === "signup" ? "bg-indigo text-white" : "text-muted"}`}
          >
            Create account
          </button>
        </div>

        <form className="space-y-3" onSubmit={onSubmit}>
          <label className="block text-xs tracking-wide text-subtle uppercase">
            Email
            <Input
              className="mt-1"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="block text-xs tracking-wide text-subtle uppercase">
            Password
            <Input
              className="mt-1"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <Button type="submit" className="w-full" disabled={locked}>
            {busy ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}
          </Button>
        </form>

        <div className="flex items-center gap-3 text-xs text-subtle">
          <div className="h-px flex-1 bg-white/10" />
          or continue with
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <div className="flex w-full flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={locked}
            onClick={() => void onOAuth("google")}
          >
            <GoogleMark />
            {oauthBusy === "google" ? "Redirecting…" : "Continue with Google"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={locked}
            onClick={() => void onOAuth("github")}
          >
            <GitHubMark />
            {oauthBusy === "github" ? "Redirecting…" : "Continue with GitHub"}
          </Button>
        </div>
      </div>
    </SiteShell>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.6h5.1c-.2 1.2-.9 2.3-1.9 3l3.1 2.4c1.8-1.7 2.9-4.1 2.9-7 0-.7-.1-1.3-.2-1.9H12Z"
      />
      <path
        fill="#34A853"
        d="M6.6 14.3 5.5 15.1l-3.1 2.4C4.2 20.6 7.8 23 12 23c3 0 5.5-1 7.3-2.8l-3.1-2.4c-.9.6-2 1-3.2 1-2.5 0-4.6-1.7-5.4-4Z"
      />
      <path
        fill="#4A90E2"
        d="M2.4 7.5C1.5 9.2 1 11 1 13s.5 3.8 1.4 5.5l3.9-3c-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9l-3.9-3Z"
      />
      <path
        fill="#FBBC05"
        d="M12 5.2c1.6 0 3.1.6 4.2 1.6l3.1-3.1C17.5 1.9 15 1 12 1 7.8 1 4.2 3.4 2.4 7.5l3.9 3c.8-2.3 2.9-4 5.4-4Z"
      />
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.5 2 2 6.6 2 12.2c0 4.5 2.9 8.3 6.9 9.6.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.4-3.4-1.4-.4-1.1-1.1-1.4-1.1-1.4-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.7 1a9.3 9.3 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.3 4.7-4.6 5 .4.3.7 1 .7 2v2.9c0 .3.2.6.7.5 4-1.3 6.9-5.1 6.9-9.6C22 6.6 17.5 2 12 2Z" />
    </svg>
  );
}
