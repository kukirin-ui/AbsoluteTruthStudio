import { useEffect, useState } from "react";
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
import { PROVIDER_GUIDE, providerForAgentId, type OutputPower } from "@/lib/providers";
import { catalogProviderLabel, catalogModel, resolvedSeatModelId, userContextForPlan } from "@/lib/engine";
import type { ModelTier } from "@/lib/tiers";
import { readOwner } from "@/lib/owner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PauseCircle, Power, ShieldAlert } from "lucide-react";
import { ModelLadder, SeatControl, planCeilingLabel } from "@/components/studio/studio-ui";

type SeatTiers = Record<AgentId, ModelTier | null>;
type SeatModels = Record<AgentId, string | null>;
type ActiveSeats = Record<AgentId, boolean>;
const POWER_LEVELS: OutputPower[] = ["low", "mid", "max"];

export function AgentMesh({
  traces,
  streaming,
  verdict,
  compact = false,
  roster,
  attachments,
  plan,
  wallet,
  seatTier,
  seatModel,
  activeSeats,
  power,
  renderPaused = false,
  hasByok = false,
  onSeat,
  onAttach,
  onUnlock,
  onSeatModel,
  onRequestByok,
  onToggleSeat,
  onPower,
}: {
  traces: AgentTrace[];
  streaming: boolean;
  verdict: Verdict;
  compact?: boolean;
  roster: Roster;
  attachments: Attachments;
  plan: PlanId;
  wallet: PluginWallet;
  seatTier?: SeatTiers;
  seatModel?: SeatModels;
  activeSeats?: ActiveSeats;
  power?: OutputPower;
  /** Visual/render path paused or waiting — Visual seat shows RENDER PAUSED, not fake LIVE */
  renderPaused?: boolean;
  hasByok?: boolean;
  onSeat: (seat: AgentId, id: string) => boolean;
  onAttach: (seat: AgentId, id: string) => boolean;
  onUnlock: (item: CatalogItem) => void;
  onSeatTier?: (seat: AgentId, tier: ModelTier | null) => void;
  onSeatModel?: (seat: AgentId, modelId: string) => void;
  onRequestByok?: () => void;
  onToggleSeat?: (seat: AgentId) => void;
  onPower?: (power: OutputPower) => void;
}) {
  const [pick, setPick] = useState<AgentId | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  void streaming; // parent drives LIVE via trace.status === "streaming"

  const owner = mounted && readOwner();
  const user = userContextForPlan(mounted ? plan : "free", owner);
  const activeCount = activeSeats ? SEAT_ORDER.filter((s) => activeSeats[s]).length : 4;

  function modelIdFor(seat: AgentId) {
    const seated = seatedItem(roster, seat);
    return resolvedSeatModelId(
      seatModel?.[seat],
      seatTier?.[seat],
      user,
      catalogProviderLabel(providerForAgentId(seated.id)),
    );
  }

  return (
    <div className="relative z-10 isolate bg-bg">
      {onPower && onToggleSeat ? (
        <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] tracking-wide text-subtle uppercase">
          <span className="text-muted">{activeCount}/4 agents</span>
          <span className="text-subtle/50">·</span>
          <span>Power</span>
          <div className="inline-flex overflow-hidden rounded-full bg-elevated shadow-[0_0_0_1px_rgb(255_255_255/0.06)]">
            {POWER_LEVELS.map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => onPower(lvl)}
                className={cn(
                  "px-2.5 py-1 text-[10px] tracking-wide uppercase transition-colors",
                  power === lvl ? "bg-indigo-glow/20 text-indigo-glow" : "text-muted hover:text-fg",
                )}
              >
                {lvl}
              </button>
            ))}
          </div>
          {!compact && mounted ? (
            <span className="ml-auto font-mono text-[10px] tracking-wide text-subtle normal-case" suppressHydrationWarning>
              PLAN: {planCeilingLabel(plan, owner)}
            </span>
          ) : null}
        </div>
      ) : null}
      {compact ? (
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {SEAT_ORDER.map((seat) => {
          const seated = seatedItem(roster, seat);
          const meta = SEAT_META[seat];
          const seatActive = activeSeats ? activeSeats[seat] !== false : true;
          const resolvedId = modelIdFor(seat);
          const resolvedName = catalogModel(resolvedId)?.name;
          const isProviderSeat =
            ["Anthropic", "OpenAI", "Google", "xAI", "Mistral", "DeepSeek", "Alibaba", "Meta"].includes(
              seated.brand,
            ) && seat !== "visual";
          const modelLabel = isProviderSeat && mounted ? (resolvedName ?? seated.name) : seated.name;
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
          const glow = meta.glow;
          return (
            <article
              key={seat}
              data-seat={seat}
              data-seat-state={ui}
              className={cn(
                "seat-tab relative overflow-hidden rounded-xl bg-panel p-2 text-left shadow-[0_0_0_1px_rgb(255_255_255/0.06)] md:p-3",
                "min-h-11",
                !seatActive && "opacity-45",
                live && "agent-working",
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
                  <p className="truncate text-[10px] font-medium tracking-wider text-indigo-glow uppercase">
                    {modelLabel}
                  </p>
                  <p className="truncate text-xs text-fg">
                    {meta.label}
                  </p>
                  <p className="truncate text-[10px] text-muted">{meta.role}</p>
                </button>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusPill status={flagged && !paused ? "flagged" : !seatActive ? "idle" : trace.status} />
                  <div className="flex items-center gap-1">
                    {onToggleSeat ? (
                      <button
                        type="button"
                        onClick={() => onToggleSeat(seat)}
                        title={seatActive ? "Idle this agent" : "Activate this agent"}
                        aria-pressed={seatActive}
                        className={cn(
                          "grid size-6 place-items-center rounded-md hover:bg-elevated",
                          seatActive ? "text-emerald-glow" : "text-subtle",
                        )}
                      >
                        <Power className="size-3" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setPick(seat)}
                      className="h-7 rounded-md px-2 text-[10px] tracking-wide text-indigo-glow uppercase hover:bg-elevated"
                    >
                      Swap
                    </button>
                  </div>
                </div>
              </header>
            </article>
          );
        })}
      </div>
      ) : (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2" data-agent-matrix>
        {SEAT_ORDER.map((seat) => {
          const seated = seatedItem(roster, seat);
          const meta = SEAT_META[seat];
          const seatActive = activeSeats ? activeSeats[seat] !== false : true;
          const resolvedId = modelIdFor(seat);
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
          const paused = ui === "RENDER PAUSED";
          const flagged = seat === "security" && (trace.status === "flagged" || verdict === "WARN");
          const tools = attachedItems(attachments, seat);
          return (
            <div
              key={seat}
              data-seat={seat}
              data-seat-state={ui}
              className={cn(!seatActive && "opacity-45")}
            >
              <SeatControl
                seat={seat}
                selectedModelId={mounted ? resolvedId : "claude-haiku-4-5"}
                user={user}
                hasByok={hasByok}
                onSelectModel={(modelId) => onSeatModel?.(seat, modelId)}
                onRequestByok={() => onRequestByok?.()}
                headerRight={
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusPill status={flagged && !paused ? "flagged" : !seatActive ? "idle" : trace.status} />
                    <div className="flex items-center gap-1">
                      {onToggleSeat ? (
                        <button
                          type="button"
                          onClick={() => onToggleSeat(seat)}
                          title={seatActive ? "Idle this agent" : "Activate this agent"}
                          aria-pressed={seatActive}
                          className={cn(
                            "grid size-7 place-items-center rounded-md hover:bg-elevated",
                            seatActive ? "text-emerald-glow" : "text-subtle",
                          )}
                        >
                          <Power className="size-3.5" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setPick(seat)}
                        className="h-7 rounded-md px-2 text-[10px] tracking-wide text-indigo-glow uppercase hover:bg-elevated"
                      >
                        Swap
                      </button>
                    </div>
                  </div>
                }
              >
                <p className="px-3 pb-3 font-mono text-[11px] leading-relaxed text-muted md:px-4">
                  {trace.content
                    ? trace.content.replace(/\s+/g, " ").slice(0, 140)
                    : paused
                      ? "Render paused — waiting on the visual path"
                      : tools.length
                        ? tools.map((t) => t.name).join(" · ")
                        : meta.framework}
                </p>
              </SeatControl>
            </div>
          );
        })}
      </div>
      )}

      <SeatPicker
        seat={pick}
        onClose={() => setPick(null)}
        roster={roster}
        attachments={attachments}
        plan={plan}
        wallet={wallet}
        currentModelId={pick ? modelIdFor(pick) : null}
        user={user}
        onSeatModel={onSeatModel}
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
  currentModelId,
  user,
  onSeatModel,
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
  currentModelId?: string | null;
  user: ReturnType<typeof userContextForPlan>;
  onSeatModel?: (seat: AgentId, modelId: string) => void;
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
  const leadProvider = providerForAgentId(current.id);
  const guide = PROVIDER_GUIDE[leadProvider];
  const showProvider =
    seat !== "visual" &&
    ["Anthropic", "OpenAI", "Google", "xAI", "Mistral", "DeepSeek", "Alibaba", "Meta"].includes(current.brand);
  const selectedId =
    currentModelId ??
    resolvedSeatModelId(null, null, user, catalogProviderLabel(leadProvider));

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        title={`Swap agent · ${meta.label}`}
        description={`${meta.framework} The seats stay in lockstep. Swap picks who runs this tab; the model ladder is clamped to your plan ceiling.`}
        className="max-h-[min(88dvh,40rem)] w-[min(100%-1.5rem,36rem)] overflow-y-auto"
      >
        <p className="mb-3 text-xs text-muted">
          Live now: <span className="text-fg">{current.name}</span> · {current.brand}
        </p>
        {onSeatModel && showProvider ? (
          <div className="mb-5">
            <ModelLadder
              selectedModelId={selectedId}
              user={user}
              onSelect={(modelId) => onSeatModel(seat, modelId)}
            />
          </div>
        ) : null}
        {showProvider ? (
        <div className="mb-5 rounded-lg bg-elevated/50 p-3">
          <p className="mb-1.5 text-[10px] tracking-wider text-indigo-glow uppercase">{guide.title}</p>
          <ul className="space-y-1">
            {guide.tips.map((tip) => (
              <li key={tip} className="flex gap-2 text-[11px] leading-snug text-muted">
                <span className="mt-1 size-1 shrink-0 rounded-full bg-indigo-glow/70" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
        ) : null}
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
