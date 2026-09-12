import { useState } from "react";
import type { AgentId, AgentTrace, PlanId, Verdict } from "@/lib/types";
import {
  SEAT_META,
  SEAT_ORDER,
  agentsForSeat,
  attachedItems,
  catalogAvailable,
  seatedItem,
  toolsForSeat,
  wireLabel,
  type Attachments,
  type CatalogItem,
  type Roster,
} from "@/lib/catalog";
import { seatUiLabel } from "@/lib/mesh";
import type { PluginWallet } from "@/lib/plugins";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PauseCircle, ShieldAlert } from "lucide-react";

export function AgentMesh({
  traces,
  streaming,
  verdict,
  compact = false,
  roster,
  attachments,
  plan,
  wallet,
  renderPaused = false,
  onSeat,
  onAttach,
  onUnlock,
}: {
  traces: AgentTrace[];
  streaming: boolean;
  verdict: Verdict;
  compact?: boolean;
  roster: Roster;
  attachments: Attachments;
  plan: PlanId;
  wallet: PluginWallet;
  /** Visual/render path paused or waiting — Visual seat shows RENDER PAUSED, not fake LIVE */
  renderPaused?: boolean;
  onSeat: (seat: AgentId, id: string) => boolean;
  onAttach: (seat: AgentId, id: string) => boolean;
  onUnlock: (item: CatalogItem) => void;
}) {
  const [pick, setPick] = useState<AgentId | null>(null);
  void streaming; // parent drives LIVE via trace.status === "streaming"

  return (
    <div className="relative z-10 isolate bg-bg">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {SEAT_ORDER.map((seat) => {
          const seated = seatedItem(roster, seat);
          const meta = SEAT_META[seat];
          const raw = traces.find((t) => t.id === seat) ?? {
            id: seat,
            status: "idle" as const,
            content: "",
          };
          const status =
            seat === "visual" && renderPaused && raw.status !== "streaming"
              ? ("render_paused" as const)
              : raw.status;
          const trace = { ...raw, status };
          const ui = seatUiLabel(trace.status);
          const live = ui === "LIVE";
          const paused = ui === "RENDER PAUSED";
          const flagged = seat === "security" && (trace.status === "flagged" || verdict === "WARN");
          const tools = attachedItems(attachments, seat);
          const glow = meta.glow;
          return (
            <article
              key={seat}
              data-seat={seat}
              data-seat-state={ui}
              className={cn(
                "relative overflow-hidden rounded-xl bg-panel p-2 text-left shadow-[0_0_0_1px_rgb(255_255_255/0.06)] md:p-3",
                compact ? "min-h-11" : "min-h-[5.5rem] md:min-h-[7.25rem]",
                "transition-[box-shadow] duration-250 ease-out",
                paused && "shadow-[0_0_0_1px_rgb(245_158_11/0.45),0_0_20px_rgb(245_158_11/0.12)]",
                flagged && !paused && !live && "shadow-[0_0_0_1px_rgb(245_158_11/0.5)]",
                trace.status === "verified" && !live && !paused && "shadow-[0_0_0_1px_rgb(16_185_129/0.35)]",
              )}
              style={
                live
                  ? {
                      boxShadow: `0 0 0 1px color-mix(in srgb, ${cssGlow(glow)} 45%, transparent), 0 0 28px color-mix(in srgb, ${cssGlow(glow)} 18%, transparent)`,
                    }
                  : undefined
              }
            >
              <div className={cn("absolute inset-y-3 left-0 w-0.5 rounded-full", meta.accent)} />
              <header className="flex items-start justify-between gap-2 pl-2">
                <button
                  type="button"
                  onClick={() => setPick(seat)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-[10px] font-medium tracking-wider text-subtle uppercase">
                    {seated.name}
                  </p>
                  <p className="truncate text-xs text-fg">
                    {meta.label}
                  </p>
                  <p className="truncate text-[10px] text-muted">{meta.role}</p>
                </button>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusPill status={flagged && !paused ? "flagged" : trace.status} />
                  <button
                    type="button"
                    onClick={() => setPick(seat)}
                    className="h-7 rounded-md px-2 text-[10px] tracking-wide text-indigo-glow uppercase hover:bg-elevated"
                  >
                    Swap
                  </button>
                </div>
              </header>
              {compact ? null : (
                <p className="mt-1.5 line-clamp-2 pl-2 font-mono text-[11px] leading-relaxed text-muted">
                  {trace.content
                    ? trace.content.replace(/\s+/g, " ").slice(0, 140)
                    : paused
                      ? "Render paused — waiting on the visual path"
                      : tools.length
                        ? tools.map((t) => t.name).join(" · ")
                        : live
                          ? "Awaiting stream…"
                          : meta.framework}
                </p>
              )}
            </article>
          );
        })}
      </div>

      <SeatPicker
        seat={pick}
        onClose={() => setPick(null)}
        roster={roster}
        attachments={attachments}
        plan={plan}
        wallet={wallet}
        onSeat={(seat, id) => {
          const ok = onSeat(seat, id);
          if (ok) setPick(null);
          return ok;
        }}
        onAttach={onAttach}
        onUnlock={onUnlock}
      />
    </div>
  );
}

function cssGlow(token: string) {
  // meta.glow is like "rgb(99_102_241)" — convert underscores for CSS color-mix
  return token.replace(/_/g, " ");
}

function SeatPicker({
  seat,
  onClose,
  roster,
  attachments,
  plan,
  wallet,
  onSeat,
  onAttach,
  onUnlock,
}: {
  seat: AgentId | null;
  onClose: () => void;
  roster: Roster;
  attachments: Attachments;
  plan: PlanId;
  wallet: PluginWallet;
  onSeat: (seat: AgentId, id: string) => boolean;
  onAttach: (seat: AgentId, id: string) => boolean;
  onUnlock: (item: CatalogItem) => void;
}) {
  if (!seat) return null;
  const meta = SEAT_META[seat];
  const current = seatedItem(roster, seat);
  const agents = agentsForSeat(seat);
  const tools = toolsForSeat(seat);
  const attached = new Set(attachments[seat] ?? []);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        title={`Swap agent · ${meta.label}`}
        description={`${meta.framework} Four specialized tabs stay in lockstep. Agent swap picks who runs this tab, then attach tools. Defaults stay Claude, Imagine, ChatGPT, and Grok until you change them.`}
        className="max-h-[min(88dvh,40rem)] w-[min(100%-1.5rem,36rem)] overflow-y-auto"
      >
        <p className="mb-3 text-xs text-muted">
          Live now: <span className="text-fg">{current.name}</span> · {current.brand}
        </p>
        <p className="mb-2 text-[10px] tracking-wider text-subtle uppercase">Agents</p>
        <ul className="mb-5 space-y-1.5">
          {agents.map((item) => (
            <PickerRow
              key={item.id}
              item={item}
              active={current.id === item.id}
              locked={!catalogAvailable(item, plan, wallet.owned)}
              kind="agent"
              onPick={() => {
                if (!catalogAvailable(item, plan, wallet.owned)) {
                  onUnlock(item);
                  return;
                }
                onSeat(seat, item.id);
              }}
            />
          ))}
        </ul>
        <p className="mb-2 text-[10px] tracking-wider text-subtle uppercase">Tools on this tab</p>
        <ul className="space-y-1.5">
          {tools.map((item) => (
            <PickerRow
              key={item.id}
              item={item}
              active={attached.has(item.id)}
              locked={!catalogAvailable(item, plan, wallet.owned)}
              kind="tool"
              onPick={() => {
                if (!catalogAvailable(item, plan, wallet.owned)) {
                  onUnlock(item);
                  return;
                }
                onAttach(seat, item.id);
              }}
            />
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function PickerRow({
  item,
  active,
  locked,
  kind,
  onPick,
}: {
  item: CatalogItem;
  active: boolean;
  locked: boolean;
  kind: "agent" | "tool";
  onPick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        className={cn(
          "flex min-h-11 w-full items-start gap-3 rounded-lg px-3 py-2 text-left",
          active ? "bg-elevated shadow-[0_0_0_1px_rgb(99_102_241/0.35)]" : "hover:bg-elevated/70",
          locked && "opacity-70",
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm text-fg">{item.name}</span>
            <span className="text-[10px] tracking-wider text-subtle uppercase">{item.brand}</span>
            {item.tier === "paid" ? <Badge variant="indigo">{item.price}</Badge> : <Badge variant="muted">Free</Badge>}
            {active ? <Badge variant="emerald">{kind === "agent" ? "On tab" : "On"}</Badge> : null}
          </span>
          <span className="mt-0.5 block text-[11px] leading-snug text-muted">{item.blurb}</span>
          <span className="mt-0.5 block text-[10px] text-subtle">{wireLabel(item.wire, item.id)}</span>
        </span>
        <span className="shrink-0 pt-1 text-[10px] tracking-wide text-indigo-glow uppercase">
          {locked ? "Unlock" : kind === "agent" ? (active ? "Live" : "Swap") : active ? "Remove" : "Attach"}
        </span>
      </button>
    </li>
  );
}

function StatusPill({ status }: { status: AgentTrace["status"] }) {
  if (status === "flagged") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium tracking-wide text-warn-glow uppercase">
        <ShieldAlert className="size-3" />
        Warn
      </span>
    );
  }
  if (status === "render_paused") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium tracking-wide text-warn-glow uppercase">
        <PauseCircle className="size-3" />
        RENDER PAUSED
      </span>
    );
  }
  if (status === "streaming") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium tracking-wide text-indigo-glow uppercase">
        <span className="pulse-dot size-1.5 rounded-full bg-indigo-glow" />
        LIVE
      </span>
    );
  }
  if (status === "verified") {
    return <span className="text-[10px] tracking-wide text-subtle uppercase">IDLE</span>;
  }
  // idle | queued — product empty / between / waiting turn = IDLE (not fake LIVE)
  return <span className="text-[10px] tracking-wide text-subtle uppercase">IDLE</span>;
}
