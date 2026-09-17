import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { SiteNav, Wordmark, AmbientGlow } from "@/components/studio/chrome";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export function SiteShell({
  title,
  kicker,
  children,
}: {
  title: string;
  kicker?: string;
  children: ReactNode;
}) {
  const { user, isPending } = useCurrentUserState();
  const isLoggedIn = !isPending && !!user;
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onLogin = pathname === "/login";

  return (
    <div className="relative min-h-dvh bg-bg text-fg">
      <AmbientGlow />
      <header className="relative z-10 flex items-center justify-between gap-3 px-4 py-3 md:px-8">
        <Link to="/" className="rounded-md">
          <Wordmark />
        </Link>
        {isLoggedIn ? (
          <Button asChild size="sm">
            <Link to="/">Open studio</Link>
          </Button>
        ) : onLogin ? null : (
          <Button asChild size="sm" variant="indigo">
            <Link to="/login">Sign in</Link>
          </Button>
        )}
      </header>
      <div className="relative z-10 mx-auto grid max-w-5xl gap-8 px-4 py-8 md:grid-cols-[14rem_1fr] md:px-8">
        <aside className="hidden md:block">
          <SiteNav />
        </aside>
        <article className="min-w-0">
          {kicker ? (
            <p className="text-[10px] font-medium tracking-[0.18em] text-subtle uppercase">{kicker}</p>
          ) : null}
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-balance md:text-4xl">
            {title}
          </h1>
          <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted">{children}</div>
          <nav className="mt-10 border-t border-border pt-4 md:hidden">
            <SiteNav />
          </nav>
        </article>
      </div>
    </div>
  );
}