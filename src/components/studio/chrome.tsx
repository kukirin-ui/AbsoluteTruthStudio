import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { PLANS, initiateCheckout, planRank, type BillingMethod } from "@/lib/billing";
import { BuyCreditsButton } from "@/components/BuyCreditsModal";
import { readOwner, unlockOwner, writeOwner } from "@/lib/owner";
import { signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { SITE_NAV } from "@/lib/site";
import type { Conversation, PlanId, SavedProject } from "@/lib/types";
import { formatRelative } from "@/lib/utils";
import {
  Brain,
  FolderKanban,
  KeyRound,
  Menu,
  MessageSquare,
  Plus,
  Puzzle,
  Share2,
  Shield,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="relative grid size-8 place-items-center rounded-md bg-elevated shadow-[0_0_0_1px_rgb(99_102_241/0.35),0_0_18px_rgb(99_102_241/0.25)]">
        <svg viewBox="0 0 24 24" className="size-4 text-indigo-glow" aria-hidden="true">
          <path
            d="M12 2.5 20.5 7v10L12 21.5 3.5 17V7L12 2.5Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path d="M8.5 12.2 11 14.7 16 9.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
        <span className="absolute -right-0.5 -bottom-0.5 size-2 rounded-full bg-emerald pulse-dot" />
      </span>
      {compact ? null : (
        <div className="leading-tight">
          <p className="font-display text-sm font-semibold tracking-tight text-fg">Absolute Truth</p>
          <p className="text-[10px] tracking-[0.18em] text-muted uppercase">Studio</p>
        </div>
      )}
    </div>
  );
}

export function HeaderBar({
  plan,
  creditsRemaining = 0,
  hasByok = false,
  onOpenPlans,
  onOpenByok,
  onOpenPlugins,
  onOpenMemory,
  leftSlot,
}: {
  plan: PlanId;
  creditsRemaining?: number | string;
  hasByok?: boolean;
  onOpenPlans: () => void;
  onOpenByok?: () => void;
  onOpenPlugins: () => void;
  onOpenMemory?: () => void;
  leftSlot?: ReactNode;
}) {
  const def = PLANS.find((p) => p.id === plan)!;
  const [owner, setOwner] = useState(false);
  useEffect(() => {
    setOwner(readOwner());
  }, []);
  return (
    <header className="relative z-20 flex items-center gap-2 px-3 py-2.5 md:gap-3 md:px-4">
      <div className="flex shrink-0 items-center gap-2">
        {leftSlot}
        <Link to="/" className="rounded-md">
          <span className="sm:hidden">
            <Wordmark compact />
          </span>
          <span className="hidden sm:block">
            <Wordmark />
          </span>
        </Link>
      </div>
      <div className="ml-auto flex min-w-0 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] md:gap-2 [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={onOpenPlans}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-elevated px-3 text-xs text-muted transition-[background-color,color] duration-150 hover:text-fg"
          title="Studio credits for metered model calls — not an included subscription API buffer"
        >
          <Wallet className="size-3.5 text-indigo-glow" />
          <span className="hidden sm:inline">Credits remaining</span>
          <Badge variant="muted" suppressHydrationWarning>
            {creditsRemaining}
          </Badge>
          {hasByok ? (
            <Badge variant="emerald" title="Bring-your-own-key connected" suppressHydrationWarning>
              BYOK
            </Badge>
          ) : null}
        </button>
        {onOpenByok ? (
          <button
            type="button"
            onClick={onOpenByok}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-elevated px-3 text-xs text-muted transition-[background-color,color] duration-150 hover:text-fg"
            title="Bring your own provider API keys"
          >
            <KeyRound className="size-3.5 text-indigo-glow" />
            <span className="hidden sm:inline">Keys</span>
          </button>
        ) : null}
        {onOpenMemory ? (
          <button
            type="button"
            onClick={onOpenMemory}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-elevated px-3 text-xs text-muted transition-[background-color,color] duration-150 hover:text-fg"
          >
            <Brain className="size-3.5 text-indigo-glow" />
            <span className="hidden sm:inline">Memory</span>
          </button>
        ) : null}
        <button
          type="button"
          onClick={onOpenPlugins}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-elevated px-3 text-xs text-muted transition-[background-color,color] duration-150 hover:text-fg"
        >
          <Puzzle className="size-3.5 text-indigo-glow" />
          <span className="hidden sm:inline">Plugins</span>
        </button>
        <button
          type="button"
          onClick={onOpenPlans}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-elevated px-3 text-xs text-muted transition-[background-color,color] duration-150 hover:text-fg"
        >
          <Shield className="size-3.5 text-emerald-glow" />
          <span className="hidden sm:inline" suppressHydrationWarning>
            {def.name}
          </span>
          <Badge variant={plan === "premium" ? "emerald" : plan === "pro" ? "indigo" : "muted"} suppressHydrationWarning>
            {owner ? "Owner" : `${def.price}${plan === "free" ? "" : "/mo"}`}
          </Badge>
        </button>
      </div>
    </header>
  );
}

export function SiteNav({ onNavigate }: { onNavigate?: () => void }) {
  const { user, isPending } = useCurrentUserState();

  if (isPending) return null;

  if (!user) {
    return (
      <nav aria-label="Site">
        <AccountControl onNavigate={onNavigate} />
      </nav>
    );
  }

  return (
    <nav aria-label="Site">
      <p className="mb-2 text-[10px] font-medium tracking-[0.16em] text-subtle uppercase">Studio</p>
      <ul className="space-y-0.5">
        {SITE_NAV.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              onClick={onNavigate}
              className="flex h-10 items-center rounded-md px-2 text-sm text-muted transition-[background-color,color] duration-150 hover:bg-elevated hover:text-fg [&.active]:bg-elevated [&.active]:text-fg"
              activeOptions={{ exact: item.to === "/" }}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
      <AccountControl onNavigate={onNavigate} />
    </nav>
  );
}

export function Library({
  conversations,
  projects,
  activeId,
  onSelectChat,
  onSelectProject,
  onDeleteChat,
  onDeleteProject,
  onNew,
  onShareChat,
  onShareProject,
  onNavigate,
}: {
  conversations: Conversation[];
  projects: SavedProject[];
  activeId: string | null;
  onSelectChat: (id: string) => void;
  onSelectProject: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onNew: () => void;
  onShareChat: (id: string) => void;
  onShareProject: (id: string) => void;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-5">
      <Button onClick={onNew} className="w-full">
        <Plus />
        New session
      </Button>

      {conversations.length === 0 && projects.length === 0 ? (
        <section className="rounded-xl bg-panel p-3.5 shadow-[0_0_0_1px_rgb(99_102_241/0.14)]">
          <p className="text-[10px] font-medium tracking-[0.16em] text-indigo-glow uppercase">
            Four minds, one brief
          </p>
          <ul className="mt-2.5 space-y-2 text-xs leading-snug text-muted">
            <li className="flex gap-2">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-indigo-glow/80" />
              <span>Claude, ChatGPT, Gemini &amp; Grok lead by default — eight models total to choose from.</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-emerald/80" />
              <span>Get a real, running React app — not a mockup.</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-indigo/80" />
              <span>Set each seat's tier, run 1–4 agents, or bring your own key for any of the eight.</span>
            </li>
          </ul>
          <p className="mt-3 border-t border-border pt-2.5 text-[11px] text-subtle">
            Ask anything to begin — every session saves right here.
          </p>
        </section>
      ) : null}

      <section>
        <p className="mb-2 flex items-center gap-2 text-[10px] font-medium tracking-[0.16em] text-subtle uppercase">
          <MessageSquare className="size-3" />
          Saved chats
        </p>
        {conversations.length === 0 ? (
          <p className="text-xs text-muted">Nothing stored on this device yet.</p>
        ) : (
          <ul className="space-y-1">
            {conversations.map((c) => (
              <li key={c.id}>
                <LibraryRow
                  active={c.id === activeId}
                  title={c.title}
                  meta={`${c.mode === "build" ? "Asset" : "Talk"} · ${formatRelative(c.updatedAt)}`}
                  onClick={() => onSelectChat(c.id)}
                  onShare={() => onShareChat(c.id)}
                  onDelete={() => onDeleteChat(c.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <p className="mb-2 flex items-center gap-2 text-[10px] font-medium tracking-[0.16em] text-subtle uppercase">
          <FolderKanban className="size-3" />
          Saved projects
        </p>
        {projects.length === 0 ? (
          <p className="text-xs text-muted">Ship a product to pin it here.</p>
        ) : (
          <ul className="space-y-1">
            {projects.map((p) => (
              <li key={p.id}>
                <LibraryRow
                  active={false}
                  title={p.title}
                  meta={`${p.files.length} files · ${formatRelative(p.updatedAt)}`}
                  onClick={() => onSelectProject(p.id)}
                  onShare={() => onShareProject(p.id)}
                  onDelete={() => onDeleteProject(p.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-auto border-t border-border pt-4">
        <SiteNav onNavigate={onNavigate} />
      </div>
    </div>
  );
}

function LibraryRow({
  active,
  title,
  meta,
  onClick,
  onShare,
  onDelete,
}: {
  active: boolean;
  title: string;
  meta: string;
  onClick: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`group flex items-center gap-1 rounded-lg px-1 py-0.5 ${active ? "bg-elevated" : "hover:bg-elevated/60"}`}
    >
      <button type="button" onClick={onClick} className="min-w-0 flex-1 px-2 py-2 text-left">
        <p className="truncate text-sm text-fg">{title}</p>
        <p className="truncate text-[11px] text-subtle">{meta}</p>
      </button>
      <button
        type="button"
        aria-label="Share"
        onClick={onShare}
        className="grid size-8 place-items-center rounded-sm text-subtle opacity-100 transition-[color,opacity] duration-150 hover:text-fg md:opacity-0 md:group-hover:opacity-100"
      >
        <Share2 className="size-3.5" />
      </button>
      <button
        type="button"
        aria-label="Delete"
        onClick={onDelete}
        className="grid size-8 place-items-center rounded-sm text-subtle opacity-100 transition-[color,opacity] duration-150 hover:text-danger md:opacity-0 md:group-hover:opacity-100"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

export function NavDrawer({ children }: { children: ReactNode }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" title="Menu">
        {children}
      </SheetContent>
    </Sheet>
  );
}

export function BillingDrawer({
  open,
  onOpenChange,
  plan,
  onGrant,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plan: PlanId;
  onGrant: (plan: PlanId) => void;
}) {
  const owner = readOwner();
  const [ownerCode, setOwnerCode] = useState("");

  async function checkout(next: Exclude<PlanId, "free">, method: BillingMethod) {
    const result = await initiateCheckout(next, method);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (result.mode === "redirect" && result.url) {
      try {
        sessionStorage.setItem("ats-pending-plan", next);
      } catch {
        /* ignore */
      }
      window.open(result.url, "_blank", "noopener,noreferrer");
      toast.message("Stripe checkout opened. After payment, tap Activate on this device.", {
        duration: 16000,
        action: {
          label: `Activate ${next === "pro" ? "Pro" : "Premium"}`,
          onClick: () => {
            onGrant(next);
            toast.success(`${next === "pro" ? "Pro" : "Premium"} is active on this device.`);
            onOpenChange(false);
          },
        },
      });
      return;
    }
    onGrant(next);
    toast.success(`${next === "pro" ? "Pro" : "Premium"} is active on this device.`);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" title="Plans" className="left-auto right-0 w-[min(100%,26rem)]">
        <p className="mb-5 text-sm text-muted">
            {owner
            ? "Owner mode — every tier and plugin is unlocked for you. Visitors start on the basic tier and unlock Pro or Premium through Stripe. Their own keys (BYOK) pay for calls but do not raise the plan ceiling."
            : "Pro and Premium are monthly subscriptions billed through Stripe. Tap checkout, then Activate on this device. You can also bring your own keys (BYOK) on any plan — a key pays for the call, it does not raise the model ceiling."}
        </p>
        <div className="mb-5">
          <BuyCreditsButton />
        </div>
        {owner ? null : (
          <form
            className="mb-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void unlockOwner(ownerCode).then((r) => {
                if (r.ok) {
                  onGrant("premium");
                  toast.success("Owner mode — all plans seated.");
                  onOpenChange(false);
                } else toast.error(r.error || "Wrong owner code.");
              });
            }}
          >
            <input
              value={ownerCode}
              onChange={(e) => setOwnerCode(e.target.value)}
              placeholder="Owner code"
              className="h-10 min-w-0 flex-1 rounded-md bg-elevated px-3 text-sm text-fg"
              autoComplete="off"
            />
            <Button type="submit" variant="outline" size="sm">
              Unlock
            </Button>
          </form>
        )}
        <div className="space-y-3">
          {PLANS.map((p) => {
            const current = p.id === plan;
            const higher = planRank(p.id) > planRank(plan);
            return (
              <article
                key={p.id}
                className={`rounded-xl bg-panel p-4 shadow-[0_0_0_1px_rgb(255_255_255/0.06)] ${p.id === "premium" ? "shadow-[0_0_0_1px_rgb(16_185_129/0.35),0_0_28px_rgb(16_185_129/0.12)]" : ""}`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-display text-lg font-medium">{p.name}</h3>
                  <p className="font-display text-lg">
                    {p.price}
                    {p.id === "free" ? "" : <span className="text-sm text-muted">/mo</span>}
                  </p>
                </div>
                <p className="mt-1 text-sm text-muted">{p.tagline}</p>
                <p className="mt-2 text-xs leading-relaxed text-fg">{p.why}</p>
                <ul className="mt-3 space-y-1.5">
                  {p.features.map((f) => (
                    <li key={f} className="text-xs leading-relaxed text-fg">
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex flex-col gap-2">
                  {current ? (
                    <Button variant="outline" disabled>
                      Current plan
                    </Button>
                  ) : p.id === "free" ? (
                    <Button variant="outline" onClick={() => onGrant("free")}>
                      Downgrade to Free
                    </Button>
                  ) : (
                    <PaidCheckoutButtons
                      plan={p.id === "premium" ? "premium" : "pro"}
                      highlight={higher}
                      onCheckout={checkout}
                      onOwnerGrant={() => onGrant(p.id)}
                    />
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PaidCheckoutButtons({
  plan,
  highlight,
  onCheckout,
  onOwnerGrant,
}: {
  plan: Exclude<PlanId, "free">;
  highlight: boolean;
  onCheckout: (plan: Exclude<PlanId, "free">, method: BillingMethod) => void;
  onOwnerGrant: () => void;
}) {
  return (
    <>
      <Button onClick={() => onCheckout(plan, "stripe")} variant={highlight ? "default" : "outline"}>
        <Wallet />
        Stripe checkout
      </Button>
      {readOwner() ? (
        <Button variant="outline" onClick={onOwnerGrant}>
          Seat on this device
        </Button>
      ) : null}
    </>
  );
}

export function AmbientGlow() {
  return (
    <div className="ambient-field" aria-hidden="true">
      <div className="orb-indigo" />
      <div className="orb-emerald" />
      <div className="orb-core" />
    </div>
  );
}

export function PlanLockNote({ text, onUpgrade }: { text: string; onUpgrade: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-elevated px-3 py-2">
      <p className="text-xs text-muted">{text}</p>
      <Button size="sm" variant="indigo" onClick={onUpgrade}>
        Upgrade
      </Button>
    </div>
  );
}

function AccountControl({ onNavigate }: { onNavigate?: () => void }) {
  const { user, isPending } = useCurrentUserState();
  const [busy, setBusy] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (isPending) return null;
  if (!user) {
    // Already on the login page — the form + OAuth buttons are the one set.
    if (pathname === "/login") return null;
    return (
      <div className="mt-4 border-t border-white/10 pt-3">
        <Link
          to="/login"
          onClick={onNavigate}
          className="flex h-10 items-center rounded-md px-2 text-sm text-indigo-glow transition-colors hover:bg-elevated"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-1 border-t border-white/10 pt-3">
      <p className="truncate px-2 text-[11px] text-subtle" title={user.primaryEmail ?? undefined}>
        {user.primaryEmail ?? "Signed in"}
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            writeOwner(false);
            await signOut("/login");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Sign-out failed — try again.");
            setBusy(false);
          }
        }}
        className="flex h-10 w-full cursor-pointer items-center rounded-md px-2 text-left text-sm text-muted transition-colors hover:bg-elevated hover:text-fg disabled:opacity-60"
      >
        {busy ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}