import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Code,
  Cpu,
  Key,
  Lock,
  Palette,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import type { AgentId, PlanId } from "@/lib/types";
import {
  DISPLAY_TIER_ORDER,
  MODEL_CATALOG,
  catalogModel,
  isTierUnlocked,
  modelsInTier,
  resolveAllowedModel,
  userContextForPlan,
  type PlanTier,
  type UserContext,
} from "@/lib/engine";
import { readOwner } from "@/lib/owner";
import { cn } from "@/lib/utils";

const SEAT_CHROME: Record<
  AgentId,
  { label: string; icon: typeof Cpu; color: string }
> = {
  architect: { label: "Architecture", icon: Cpu, color: "text-indigo-glow" },
  visual: { label: "Visual / UI", icon: Palette, color: "text-emerald-glow" },
  coder: { label: "Coder", icon: Code, color: "text-indigo-glow" },
  security: { label: "Verifier / Security", icon: Shield, color: "text-warn-glow" },
};

function tierBadgeClass(tier: PlanTier) {
  switch (tier) {
    case "max":
      return "bg-elevated text-fg shadow-[0_0_0_1px_rgb(255_255_255/0.12)]";
    case "high":
      return "bg-indigo/15 text-indigo-glow";
    case "standard":
      return "bg-emerald/10 text-emerald-glow";
    default:
      return "bg-elevated text-muted";
  }
}

export function studioUserContext(plan: PlanId, owner = readOwner()): UserContext {
  return userContextForPlan(plan, owner);
}

export function TierBadge({ tier }: { tier: PlanTier }) {
  return (
    <span
      className={cn(
        "rounded px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase",
        tierBadgeClass(tier),
      )}
    >
      {tier}
    </span>
  );
}

export function planCeilingLabel(plan: PlanId, isOwner: boolean) {
  if (isOwner) return "OWNER (UNRESTRICTED)";
  return plan.toUpperCase();
}

export function ModelLadder({
  selectedModelId,
  user,
  onSelect,
}: {
  selectedModelId: string;
  user: UserContext;
  onSelect: (modelId: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold tracking-wider text-subtle uppercase">
        Select model tier
      </p>
      {DISPLAY_TIER_ORDER.map((tier) => {
        const models = modelsInTier(tier);
        if (models.length === 0) return null;
        const unlocked = isTierUnlocked(tier, user);
        return (
          <div key={tier} className="space-y-1">
            {models.map((model) => {
              const current = model.id === selectedModelId;
              return (
                <button
                  key={model.id}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => {
                    try {
                      const resolution = resolveAllowedModel(model.id, user);
                      if (resolution.wasClamped && resolution.reason) {
                        toast.message(resolution.reason);
                      }
                      onSelect(resolution.allowedModelId);
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Unknown model.");
                    }
                  }}
                  className={cn(
                    "flex min-h-11 w-full items-center justify-between rounded-md px-3 py-2.5 text-left transition-colors",
                    current
                      ? "bg-elevated text-fg shadow-[0_0_0_1px_rgb(99_102_241/0.4)]"
                      : unlocked
                        ? "bg-elevated/40 text-fg hover:bg-elevated"
                        : "cursor-not-allowed bg-bg/40 text-subtle opacity-60",
                  )}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className={cn("truncate text-sm", unlocked ? "text-fg" : "text-muted")}>
                      {model.name}
                    </span>
                    <span className="font-mono text-[10px] text-subtle">{model.provider}</span>
                  </span>
                  <span className="ml-3 flex shrink-0 items-center gap-2">
                    <TierBadge tier={tier} />
                    {!unlocked ? (
                      <span className="inline-flex items-center gap-1 rounded bg-warn/10 px-1.5 py-0.5 text-[10px] text-warn-glow">
                        <Lock className="size-2.5" />
                        Upgrade
                      </span>
                    ) : null}
                    {current ? <Check className="size-3.5 text-emerald-glow" /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        );
      })}
      {!user.isOwner ? (
        <div className="flex items-start gap-2 rounded-md bg-warn/10 px-2.5 py-2 text-[11px] leading-snug text-warn-glow/90">
          <AlertTriangle className="mt-0.5 size-3 shrink-0" />
          <p>
            Plan ceilings apply to every run. A personal API key changes who pays — it does not
            raise your subscription tier.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function SeatControl({
  seat,
  selectedModelId,
  user,
  hasByok,
  headerRight,
  children,
  onSelectModel,
  onRequestByok,
  defaultExpanded = false,
  expanded: expandedProp,
  onExpandedChange,
}: {
  seat: AgentId;
  selectedModelId: string;
  user: UserContext;
  hasByok: boolean;
  headerRight?: ReactNode;
  children?: ReactNode;
  onSelectModel: (modelId: string) => void;
  onRequestByok: () => void;
  defaultExpanded?: boolean;
  expanded?: boolean;
  onExpandedChange?: (open: boolean) => void;
}) {
  const [uncontrolled, setUncontrolled] = useState(defaultExpanded);
  const expanded = expandedProp ?? uncontrolled;
  function setExpanded(next: boolean) {
    onExpandedChange?.(next);
    if (expandedProp === undefined) setUncontrolled(next);
  }
  const meta = SEAT_CHROME[seat];
  const Icon = meta.icon;
  const model = catalogModel(selectedModelId) ?? MODEL_CATALOG["claude-haiku-4-5"]!;

  return (
    <article
      data-seat-control={seat}
      className="overflow-hidden rounded-xl bg-panel/70 shadow-[0_0_0_1px_rgb(255_255_255/0.06)] backdrop-blur-xl"
    >
      <div className="flex items-center gap-2 p-3 md:p-4">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-lg bg-bg shadow-[0_0_0_1px_rgb(255_255_255/0.08)]",
              meta.color,
            )}
          >
            <Icon className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-fg">{meta.label}</span>
            <span className="flex items-center gap-1 truncate text-xs text-muted">
              {model.name}
              {hasByok ? <Key className="size-2.5 shrink-0 text-indigo-glow" /> : null}
            </span>
          </span>
          <ChevronDown
            className={cn(
              "ml-auto size-4 shrink-0 text-subtle transition-transform duration-200",
              expanded && "rotate-180",
            )}
          />
        </button>
        {headerRight}
      </div>
      {children}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
          <div className="min-h-0 overflow-hidden" {...(!expanded ? { inert: true } : {})}>
          <div className="space-y-4 border-t border-border bg-bg/60 px-3 py-4 md:px-4">
            <button
              type="button"
              onClick={onRequestByok}
              className={cn(
                "flex min-h-11 w-full items-center justify-between rounded-lg px-3 py-3 text-left transition-colors",
                hasByok
                  ? "bg-indigo/10 text-indigo-glow shadow-[0_0_0_1px_rgb(99_102_241/0.28)]"
                  : "bg-elevated/50 text-muted shadow-[0_0_0_1px_rgb(255_255_255/0.06)] hover:text-fg",
              )}
            >
              <span className="flex items-center gap-2">
                <Key className="size-4" />
                <span className="text-sm font-medium">
                  {hasByok ? "Personal API key on file" : "Use personal API key"}
                </span>
              </span>
              {hasByok ? <Check className="size-4 text-indigo-glow" /> : null}
            </button>
            <ModelLadder
              selectedModelId={selectedModelId}
              user={user}
              onSelect={(modelId) => {
                onSelectModel(modelId);
                setExpanded(false);
              }}
            />
          </div>
        </div>
      </div>
    </article>
  );
}
