import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { SiteShell } from "@/components/studio/site-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";
import { SignInButtons } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Sign in · Absolute Truth Studio" }] }),
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

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
          ? await authClient.signUp.email({ email, password, name: name || email.split("@")[0] })
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
          {mode === "signup" && (
            <label className="block text-xs tracking-wide text-subtle uppercase">
              Name
              <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" />
            </label>
          )}
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
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}
          </Button>
        </form>

        <div className="flex items-center gap-3 text-xs text-subtle">
          <div className="h-px flex-1 bg-white/10" />
          or continue with
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <SignInButtons />
      </div>
    </SiteShell>
  );
}
