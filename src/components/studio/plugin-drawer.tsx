import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  CATALOG,
  CATALOG_COUNTS,
  SEAT_META,
  catalogAvailable,
  catalogOwnKey,
  hasAttached,
  isSeated,
  wireLabel,
  type Attachments,
  type CatalogItem,
  type Roster,
} from "@/lib/catalog";
import {
  creditBalance,
  isPluginOwned,
  mediaCost,
  pluginById,
  purchaseCredits,
  purchasePlugin,
  type PluginWallet,
} from "@/lib/plugins";
import type { AgentId, PlanId } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Puzzle, Wallet } from "lucide-react";
import { toast } from "sonner";

type Filter = "all" | "free" | "paid" | "on";

export function PluginDrawer({
  open,
  onOpenChange,
  plan,
  wallet,
  roster,
  attachments,
  focusId,
  onOwn,
  onCredits,
  onPrefer,
  onSeat,
  onAttach,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plan: PlanId;
  wallet: PluginWallet;
  roster: Roster;
  attachments: Attachments;
  focusId?: string | null;
  onOwn: (pluginId: string) => void;
  onCredits: (pluginId: string, modelId: string, credits: number) => void;
  onPrefer: (pluginId: string, modelId: string) => void;
  onSeat: (seat: AgentId, id: string) => boolean;
  onAttach: (seat: AgentId, id: string) => boolean;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const items = useMemo(() => {
    return CATALOG.filter((item) => {
      if (filter === "free") return item.tier === "free";
      if (filter === "paid") return item.tier === "paid";
      if (filter === "on") return isSeated(roster, item.id) || hasAttached(attachments, item.id);
      return true;
    });
  }, [filter, roster, attachments]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" title="Plugins" className="left-auto right-0 w-[min(100%,28rem)]">
        <p className="mb-3 text-sm text-muted">
          {CATALOG_COUNTS.total} agents and tools — {CATALOG_COUNTS.free} free, {CATALOG_COUNTS.paid} paid.
          Attach any tool to the tabs it supports. Four specialized tabs stay in lockstep — agent swap per tab.
        </p>
        <div className="mb-4 flex flex-wrap gap-1">
          {(
            [
              ["all", `All ${CATALOG_COUNTS.total}`],
              ["free", `Free ${CATALOG_COUNTS.free}`],
              ["paid", `Paid ${CATALOG_COUNTS.paid}`],
              ["on", "On tabs"],
            ] as const
          ).map(([id, label]) => (
            <Button
              key={id}
              type="button"
              size="sm"
              variant={filter === id ? "default" : "ghost"}
              onClick={() => setFilter(id)}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="space-y-3 overflow-y-auto pb-8">
          {items.map((item) => (
            <CatalogCard
              key={item.id}
              item={item}
              plan={plan}
              wallet={wallet}
              roster={roster}
              attachments={attachments}
              highlight={focusId === item.id || focusId === item.pluginId}
              onOwn={onOwn}
              onCredits={onCredits}
              onPrefer={onPrefer}
              onSeat={onSeat}
              onAttach={onAttach}
            />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CatalogCard({
  item,
  plan,
  wallet,
  roster,
  attachments,
  highlight,
  onOwn,
  onCredits,
  onPrefer,
  onSeat,
  onAttach,
}: {
  item: CatalogItem;
  plan: PlanId;
  wallet: PluginWallet;
  roster: Roster;
  attachments: Attachments;
  highlight: boolean;
  onOwn: (pluginId: string) => void;
  onCredits: (pluginId: string, modelId: string, credits: number) => void;
  onPrefer: (pluginId: string, modelId: string) => void;
  onSeat: (seat: AgentId, id: string) => boolean;
  onAttach: (seat: AgentId, id: string) => boolean;
}) {
  const available = catalogAvailable(item, plan, wallet.owned);
  const seated = isSeated(roster, item.id);
  const attached = hasAttached(attachments, item.id);
  const plugin = item.pluginId ? pluginById(item.pluginId) : undefined;
  const preferred =
    plugin && wallet.preferredModel[plugin.id]
      ? wallet.preferredModel[plugin.id]
      : plugin?.models[plan === "premium" && plugin.models.length > 1 ? plugin.models.length - 1 : 0]?.id;

  async function integrate() {
    const result = await purchasePlugin(catalogOwnKey(item));
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    onOwn(result.pluginId);
    toast.success(`${item.name} is unlocked.`);
  }

  async function buyPack(modelId: string, packId: string) {
    const result = await purchaseCredits(modelId, packId);
    if (!result.ok || result.kind !== "credits") {
      toast.error(!result.ok ? result.error : "Could not add credits.");
      return;
    }
    onCredits(result.pluginId, result.modelId, result.credits);
    toast.success(`${result.credits} credits added to that model.`);
  }

  function seatOrAttach(seat: AgentId) {
    if (!available) {
      void integrate();
      return;
    }
    if (item.kind === "agent") {
      const ok = onSeat(seat, item.id);
      toast.success(ok ? `${item.name} seated as ${SEAT_META[seat].label}.` : "Could not seat that agent.");
      return;
    }
    const ok = onAttach(seat, item.id);
    const nowOn = (attachments[seat] ?? []).includes(item.id);
    toast.success(ok ? (nowOn ? `${item.name} detached.` : `${item.name} attached to ${SEAT_META[seat].label}.`) : "Could not attach that tool.");
  }

  return (
    <article
      className={cn(
        "rounded-xl bg-panel p-4 shadow-[0_0_0_1px_rgb(255_255_255/0.06)]",
        highlight && "shadow-[0_0_0_1px_rgb(99_102_241/0.45),0_0_28px_rgb(99_102_241/0.12)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] tracking-wider text-subtle uppercase">
            {item.brand} · {item.kind} · {item.seats.map((s) => SEAT_META[s].label).join(" / ")}
          </p>
          <h3 className="font-display text-lg font-medium text-fg">{item.name}</h3>
        </div>
        {seated || attached ? (
          <Badge variant="emerald">{seated ? "Seated" : "On"}</Badge>
        ) : available ? (
          <Badge variant="muted">{item.tier === "free" ? "Free" : "Ready"}</Badge>
        ) : (
          <Badge variant="indigo">{item.price}</Badge>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">{item.blurb}</p>
      <p className="mt-1 text-[11px] text-subtle">
        {item.why} · {wireLabel(item.wire, item.id)}
      </p>

      {!available ? (
        <Button className="mt-3 w-full" variant="outline" onClick={() => void integrate()}>
          <Puzzle />
          Integrate {item.price}
        </Button>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {item.seats.map((seat) => {
          const live =
            item.kind === "agent" ? roster[seat] === item.id : (attachments[seat] ?? []).includes(item.id);
          return (
            <Button
              key={seat}
              type="button"
              size="sm"
              variant={live ? "default" : "outline"}
              onClick={() => seatOrAttach(seat)}
            >
              {live
                ? item.kind === "agent"
                  ? `Seated · ${SEAT_META[seat].label}`
                  : `On ${SEAT_META[seat].label}`
                : item.kind === "agent"
                  ? `Seat ${SEAT_META[seat].label}`
                  : `Attach ${SEAT_META[seat].label}`}
            </Button>
          );
        })}
      </div>

      {available && plugin && plugin.models.length > 0 ? (
        <ul className="mt-3 space-y-3">
          {plugin.models.map((model) => {
            const bal = creditBalance(wallet, model.id);
            const cost = mediaCost(model, model.durationCosts ? 10 : undefined);
            const selected = preferred === model.id;
            return (
              <li key={model.id} className="rounded-lg bg-elevated px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => onPrefer(plugin.id, model.id)}
                  className="flex w-full items-start justify-between gap-2 text-left"
                >
                  <span>
                    <span className="block text-sm text-fg">{model.label}</span>
                    <span className="block text-[11px] text-muted">{model.blurb}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-muted">
                    {bal} cr
                    {selected ? " · live" : ""}
                  </span>
                </button>
                <p className="mt-1 text-[11px] text-subtle">
                  {model.durationCosts
                    ? `${model.durationCosts[6]} cr / 6s · ${model.durationCosts[10]} cr / 10s`
                    : `${cost} cr per run`}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {model.packs.map((pack) => (
                    <Button
                      key={pack.id}
                      type="button"
                      size="sm"
                      variant={selected ? "default" : "outline"}
                      onClick={() => void buyPack(model.id, pack.id)}
                    >
                      <Wallet />
                      {pack.credits} cr · {pack.price}
                    </Button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      ) : available && item.kind === "tool" ? (
        <p className="mt-3 text-xs text-emerald-glow">Attached tools ride with the four-seat mesh automatically.</p>
      ) : plugin && isPluginOwned(wallet, plugin.id, plan) && plugin.kind === "media" ? (
        <p className="mt-2 text-xs text-emerald-glow">Included on your plan. Packs below are extra volume only.</p>
      ) : null}
    </article>
  );
}
