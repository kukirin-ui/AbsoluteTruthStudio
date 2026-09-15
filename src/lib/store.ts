import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import type {
  Conversation,
  PlanId,
  SavedProject,
  StudioMode,
  ChatMessage,
  ProjectFile,
  Branch,
  MediaAsset,
  AgentMemory,
  AgentId,
  Entitlement,
} from "./types";
import { EMPTY_MEMORY } from "./types";
import { uid } from "./utils";
import { EMPTY_WALLET, type PluginWallet } from "./plugins";
import { EMPTY_REFERRAL, makeReferralCode, type ReferralState } from "./referral";
import { readOwner } from "./owner";
import {
  DEFAULT_ATTACHMENTS,
  DEFAULT_ROSTER,
  SEAT_ORDER,
  catalogById,
  catalogOwnKey,
  normalizeAttachments,
  normalizeRoster,
  type Attachments,
  type Roster,
} from "./catalog";
import { catalogModel, clampStoredSeatModels, userContextForPlan } from "./engine";
import type { ModelTier } from "./tiers";
import type { OutputPower } from "./providers";

export type SeatTiers = Record<AgentId, ModelTier | null>;
export type SeatModels = Record<AgentId, string | null>;
export type ActiveSeats = Record<AgentId, boolean>;

/** null tier = "auto" (run at the plan's ceiling). */
export const DEFAULT_SEAT_TIERS: SeatTiers = {
  architect: null,
  visual: null,
  coder: null,
  security: null,
};

export const DEFAULT_ACTIVE_SEATS: ActiveSeats = {
  architect: true,
  visual: true,
  coder: true,
  security: true,
};

/** null model = auto (plan ceiling for the seated provider). */
export const DEFAULT_SEAT_MODELS: SeatModels = {
  architect: null,
  visual: null,
  coder: null,
  security: null,
};

function normalizeSeatTiers(raw?: Partial<SeatTiers> | null): SeatTiers {
  const valid = new Set(["basic", "standard", "high", "max"]);
  const next: SeatTiers = { ...DEFAULT_SEAT_TIERS };
  for (const seat of SEAT_ORDER) {
    const v = raw?.[seat];
    next[seat] = typeof v === "string" && valid.has(v) ? (v as ModelTier) : null;
  }
  return next;
}

function normalizeSeatModels(raw?: Partial<SeatModels> | null): SeatModels {
  const next: SeatModels = { ...DEFAULT_SEAT_MODELS };
  for (const seat of SEAT_ORDER) {
    const v = raw?.[seat];
    next[seat] = typeof v === "string" && v.length > 0 ? v : null;
  }
  return next;
}

function normalizeActiveSeats(raw?: Partial<ActiveSeats> | null): ActiveSeats {
  const next: ActiveSeats = { ...DEFAULT_ACTIVE_SEATS };
  for (const seat of SEAT_ORDER) {
    if (typeof raw?.[seat] === "boolean") next[seat] = raw[seat] as boolean;
  }
  // Never let every seat be idle — the mesh needs at least one voice.
  if (!SEAT_ORDER.some((s) => next[s])) next.architect = true;
  return next;
}

/** Persist is manual-only: no keystroke / stream thrash into localStorage. */
let persistPaused = false;
/** When true, the next zustand persist setItem may write. Cleared after write. */
let persistFlush = false;

export function pauseStudioPersist() {
  persistPaused = true;
}

/** Unpause after mesh/stream — does NOT write. Use flushStudioPersist for Save. */
export function resumeStudioPersist() {
  persistPaused = false;
}

/** Explicit write: Manual Save, conversation close, or plan change. */
export function flushStudioPersist() {
  persistPaused = false;
  persistFlush = true;
  const s = useStudio.getState();
  useStudio.setState({ ...s });
}

function compactUrl(url?: string) {
  if (!url) return undefined;
  if (url.startsWith("data:") || url.startsWith("blob:")) return undefined;
  return url.slice(0, 2000);
}

function compactMedia(media?: MediaAsset): MediaAsset | undefined {
  if (!media) return undefined;
  return {
    ...media,
    url: compactUrl(media.url),
    poster: compactUrl(media.poster),
    shots: media.shots?.slice(0, 8).map((s) => ({
      ...s,
      url: compactUrl(s.url) ?? "",
      prompt: s.prompt.slice(0, 400),
    })),
    error: media.error?.slice(0, 280),
  };
}

function compactMessage(m: ChatMessage): ChatMessage {
  return {
    ...m,
    content: m.content.slice(0, 12_000),
    // Keep full generated sources for See Code — do not truncate file bodies.
    files: m.files?.slice(0, 24).map((f) => ({
      ...f,
      content: f.content.slice(0, 200_000),
    })),
    media: compactMedia(m.media),
    agents: m.agents?.map((a) => ({ ...a, content: a.content.slice(0, 800) })),
  };
}

function compactState(s: {
  plan: PlanId;
  wallet: PluginWallet;
  memory: AgentMemory;
  referral: ReferralState;
  entitlement: Entitlement;
  roster: Roster;
  attachments: Attachments;
  seatTier: SeatTiers;
  seatModel: SeatModels;
  activeSeats: ActiveSeats;
  power: OutputPower;
  conversations: Conversation[];
  projects: SavedProject[];
  activeConversationId: string | null;
}) {
  return {
    plan: s.plan,
    wallet: s.wallet,
    memory: s.memory,
    referral: s.referral,
    entitlement: s.entitlement,
    roster: normalizeRoster(s.roster),
    attachments: normalizeAttachments(s.attachments),
    seatTier: normalizeSeatTiers(s.seatTier),
    seatModel: normalizeSeatModels(s.seatModel),
    activeSeats: normalizeActiveSeats(s.activeSeats),
    power: s.power,
    activeConversationId: s.activeConversationId,
    conversations: s.conversations.slice(0, 8).map((c) => ({
      ...c,
      branches: c.branches.slice(0, 3).map((b) => ({
        ...b,
        messages: b.messages.slice(-16).map(compactMessage),
      })),
    })),
    projects: s.projects.slice(0, 8).map((p) => ({
      ...p,
      files: p.files.slice(0, 24).map((f) => ({ ...f, content: f.content.slice(0, 200_000) })),
      media: compactMedia(p.media),
    })),
  };
}

const memoryStorage: StateStorage = {
  getItem: (name) => {
    if (typeof localStorage === "undefined") return null;
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    // Manual-only persist: ignore ambient zustand writes unless flushStudioPersist armed it.
    if (persistPaused || !persistFlush || typeof localStorage === "undefined") return;
    persistFlush = false;
    try {
      if (value.length > 2_400_000) return;
      localStorage.setItem(name, value);
    } catch {
      try {
        localStorage.removeItem(name);
      } catch {
        /* ignore quota */
      }
    }
  },
  removeItem: (name) => {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

type StudioState = {
  plan: PlanId;
  wallet: PluginWallet;
  memory: AgentMemory;
  referral: ReferralState;
  entitlement: Entitlement;
  roster: Roster;
  attachments: Attachments;
  seatTier: SeatTiers;
  seatModel: SeatModels;
  activeSeats: ActiveSeats;
  power: OutputPower;
  conversations: Conversation[];
  projects: SavedProject[];
  activeConversationId: string | null;
  setPlan: (plan: PlanId) => void;
  setSeat: (seat: AgentId, catalogId: string) => boolean;
  setSeatTier: (seat: AgentId, tier: ModelTier | null) => void;
  setSeatModel: (seat: AgentId, modelId: string | null) => void;
  toggleSeatActive: (seat: AgentId) => void;
  setPower: (power: OutputPower) => void;
  toggleAttachment: (seat: AgentId, catalogId: string) => boolean;
  setMemory: (id: AgentId, text: string) => void;
  ensureReferralCode: () => string;
  setReferredBy: (code: string) => void;
  applyFounding: (until: number) => void;
  applyReferrerMonth: (until: number) => void;
  setConversions: (n: number) => void;
  ownPlugin: (pluginId: string) => void;
  addCredits: (pluginId: string, modelId: string, credits: number) => void;
  setPreferredModel: (pluginId: string, modelId: string) => void;
  spendCredits: (modelId: string, amount: number) => boolean;
  refundCredits: (modelId: string, amount: number) => void;
  markIncludedUsed: () => void;
  markVideoUsed: (plan: PlanId) => void;
  clearFailedMedia: () => void;
  newConversation: (mode: StudioMode) => Conversation;
  setActiveConversation: (id: string | null) => void;
  renameConversation: (id: string, title: string) => void;
  deleteConversation: (id: string) => void;
  appendMessage: (conversationId: string, branchId: string, message: ChatMessage) => void;
  replaceMessage: (conversationId: string, branchId: string, message: ChatMessage) => void;
  forkBranch: (conversationId: string, fromMessageId: string) => string | null;
  setActiveBranch: (conversationId: string, branchId: string) => void;
  upsertProject: (
    project: Omit<SavedProject, "id" | "createdAt" | "updatedAt"> & { id?: string },
  ) => SavedProject;
  deleteProject: (id: string) => void;
  updateProjectFiles: (id: string, files: ProjectFile[]) => void;
  updateProjectMedia: (id: string, media: MediaAsset) => void;
};

function mainBranch(): Branch {
  return {
    id: "main",
    label: "Main",
    parentBranchId: null,
    forkFromMessageId: null,
    messages: [],
  };
}

export const useStudio = create<StudioState>()(
  persist(
    (set, get) => ({
      plan: "free",
      wallet: EMPTY_WALLET,
      memory: EMPTY_MEMORY,
      referral: EMPTY_REFERRAL,
      entitlement: {},
      roster: { ...DEFAULT_ROSTER },
      attachments: {
        architect: [...DEFAULT_ATTACHMENTS.architect],
        visual: [...DEFAULT_ATTACHMENTS.visual],
        coder: [...DEFAULT_ATTACHMENTS.coder],
        security: [...DEFAULT_ATTACHMENTS.security],
      },
      seatTier: { ...DEFAULT_SEAT_TIERS },
      seatModel: { ...DEFAULT_SEAT_MODELS },
      activeSeats: { ...DEFAULT_ACTIVE_SEATS },
      power: "mid",
      conversations: [],
      projects: [],
      activeConversationId: null,

      setPlan: (plan) => {
        const user = userContextForPlan(plan, readOwner());
        set((s) => ({
          plan,
          seatModel: clampStoredSeatModels(normalizeSeatModels(s.seatModel), user),
        }));
        // Plan change is an explicit persist point (no ambient autosave).
        queueMicrotask(() => flushStudioPersist());
      },

      setSeatTier: (seat, tier) =>
        set((s) => ({
          seatTier: { ...s.seatTier, [seat]: tier },
          // A raw tier pick clears an explicit model so auto/tier resolution takes over.
          seatModel: { ...s.seatModel, [seat]: null },
        })),

      setSeatModel: (seat, modelId) =>
        set((s) => {
          const def = modelId ? catalogModel(modelId) : undefined;
          return {
            seatModel: { ...s.seatModel, [seat]: modelId },
            seatTier: { ...s.seatTier, [seat]: def?.tier ?? s.seatTier[seat] },
          };
        }),

      toggleSeatActive: (seat) =>
        set((s) => {
          const next = { ...s.activeSeats, [seat]: !s.activeSeats[seat] };
          if (!SEAT_ORDER.some((x) => next[x])) return s; // keep at least one seat live
          return { activeSeats: next };
        }),

      setPower: (power) => set({ power }),

      setSeat: (seat, catalogId) => {
        const item = catalogById(catalogId);
        if (!item || item.kind !== "agent" || !item.seats.includes(seat)) return false;
        const plan = effectivePlan(get());
        const owned = get().wallet.owned;
        if (item.tier === "paid" && !item.includedIn.includes(plan) && !owned.includes(catalogOwnKey(item)) && !owned.includes(item.id)) {
          return false;
        }
        set((s) => ({ roster: { ...s.roster, [seat]: item.id } }));
        return true;
      },

      toggleAttachment: (seat, catalogId) => {
        const item = catalogById(catalogId);
        if (!item || item.kind !== "tool" || !item.seats.includes(seat)) return false;
        const plan = effectivePlan(get());
        const owned = get().wallet.owned;
        const on = get().attachments[seat]?.includes(item.id);
        if (!on && item.tier === "paid" && !item.includedIn.includes(plan) && !owned.includes(catalogOwnKey(item)) && !owned.includes(item.id)) {
          return false;
        }
        set((s) => {
          const current = s.attachments[seat] ?? [];
          const next = current.includes(item.id)
            ? current.filter((id) => id !== item.id)
            : [...current, item.id];
          return { attachments: { ...s.attachments, [seat]: next } };
        });
        return true;
      },

      setMemory: (id, text) =>
        set((s) => ({
          memory: { ...s.memory, [id]: text.slice(0, 4000) },
        })),

      ensureReferralCode: () => {
        const existing = get().referral.code;
        if (existing) return existing;
        const code = makeReferralCode();
        set((s) => ({ referral: { ...s.referral, code, conversions: s.referral.conversions ?? 0 } }));
        return code;
      },

      setReferredBy: (code) =>
        set((s) => {
          if (s.referral.referredBy || !code || code === s.referral.code) return s;
          return { referral: { ...s.referral, referredBy: code.toUpperCase() } };
        }),

      applyFounding: (until) =>
        set((s) => ({
          plan: "pro",
          entitlement: { ...s.entitlement, founding: true, foundingUntil: until, proUntil: until },
          referral: { ...s.referral, founding: true, foundingUntil: until },
        })),

      applyReferrerMonth: (until) =>
        set((s) => ({
          entitlement: {
            ...s.entitlement,
            proUntil: Math.max(s.entitlement.proUntil ?? 0, until),
          },
        })),

      setConversions: (n) =>
        set((s) => ({ referral: { ...s.referral, conversions: n } })),

      ownPlugin: (pluginId) =>
        set((s) => ({
          wallet: {
            ...s.wallet,
            owned: s.wallet.owned.includes(pluginId) ? s.wallet.owned : [...s.wallet.owned, pluginId],
          },
        })),

      addCredits: (pluginId, modelId, credits) =>
        set((s) => ({
          wallet: {
            ...s.wallet,
            owned: s.wallet.owned.includes(pluginId) ? s.wallet.owned : [...s.wallet.owned, pluginId],
            credits: {
              ...s.wallet.credits,
              [modelId]: (s.wallet.credits[modelId] ?? 0) + credits,
            },
            preferredModel: { ...s.wallet.preferredModel, [pluginId]: modelId },
          },
        })),

      setPreferredModel: (pluginId, modelId) =>
        set((s) => ({
          wallet: {
            ...s.wallet,
            preferredModel: { ...s.wallet.preferredModel, [pluginId]: modelId },
          },
        })),

      spendCredits: (modelId, amount) => {
        const have = get().wallet.credits[modelId] ?? 0;
        if (have < amount) return false;
        set((s) => ({
          wallet: {
            ...s.wallet,
            credits: { ...s.wallet.credits, [modelId]: have - amount },
          },
        }));
        return true;
      },

      refundCredits: (modelId, amount) =>
        set((s) => ({
          wallet: {
            ...s.wallet,
            credits: {
              ...s.wallet.credits,
              [modelId]: (s.wallet.credits[modelId] ?? 0) + amount,
            },
          },
        })),

      markIncludedUsed: () =>
        set((s) => ({
          wallet: { ...s.wallet, includedUsed: (s.wallet.includedUsed ?? 0) + 1 },
        })),

      markVideoUsed: (plan) =>
        set((s) => ({
          wallet: {
            ...s.wallet,
            videoUsed: {
              ...s.wallet.videoUsed,
              [plan]: (s.wallet.videoUsed?.[plan] ?? 0) + 1,
            },
          },
        })),

      clearFailedMedia: () =>
        set((s) => ({
          conversations: s.conversations.map((c) => ({
            ...c,
            branches: c.branches.map((b) => ({
              ...b,
              messages: b.messages.map((m) =>
                m.media?.status === "failed" ? { ...m, media: undefined } : m,
              ),
            })),
          })),
          projects: s.projects.map((p) =>
            p.media?.status === "failed" ? { ...p, media: undefined } : p,
          ),
        })),

      newConversation: (mode) => {
        const convo: Conversation = {
          id: uid("convo"),
          title: mode === "build" ? "Untitled asset" : "New session",
          mode,
          activeBranchId: "main",
          branches: [mainBranch()],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((s) => ({
          conversations: [convo, ...s.conversations],
          activeConversationId: convo.id,
        }));
        return convo;
      },

      setActiveConversation: (id) => set({ activeConversationId: id }),

      renameConversation: (id, title) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, title, updatedAt: Date.now() } : c,
          ),
        })),

      deleteConversation: (id) =>
        set((s) => ({
          conversations: s.conversations.filter((c) => c.id !== id),
          projects: s.projects.filter((p) => p.conversationId !== id),
          activeConversationId: s.activeConversationId === id ? null : s.activeConversationId,
        })),

      appendMessage: (conversationId, branchId, message) =>
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== conversationId) return c;
            return {
              ...c,
              updatedAt: Date.now(),
              title:
                c.branches.find((b) => b.id === c.activeBranchId)?.messages.length === 0 &&
                message.role === "user"
                  ? message.content.replace(/\s+/g, " ").slice(0, 48) || c.title
                  : c.title,
              branches: c.branches.map((b) =>
                b.id === branchId ? { ...b, messages: [...b.messages, message] } : b,
              ),
            };
          }),
        })),

      replaceMessage: (conversationId, branchId, message) =>
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== conversationId) return c;
            return {
              ...c,
              updatedAt: Date.now(),
              branches: c.branches.map((b) =>
                b.id === branchId
                  ? {
                      ...b,
                      messages: b.messages.map((m) => (m.id === message.id ? message : m)),
                    }
                  : b,
              ),
            };
          }),
        })),

      forkBranch: (conversationId, fromMessageId) => {
        const convo = get().conversations.find((c) => c.id === conversationId);
        if (!convo) return null;
        const current = convo.branches.find((b) => b.id === convo.activeBranchId);
        if (!current) return null;
        const idx = current.messages.findIndex((m) => m.id === fromMessageId);
        if (idx < 0) return null;
        const n = convo.branches.length;
        const branch: Branch = {
          id: uid("br"),
          label: `Fork ${n}`,
          parentBranchId: current.id,
          forkFromMessageId: fromMessageId,
          messages: current.messages.slice(0, idx + 1).map((m) => ({ ...m })),
        };
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  activeBranchId: branch.id,
                  branches: [...c.branches, branch],
                  updatedAt: Date.now(),
                }
              : c,
          ),
        }));
        return branch.id;
      },

      setActiveBranch: (conversationId, branchId) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === conversationId ? { ...c, activeBranchId: branchId } : c,
          ),
        })),

      upsertProject: (input) => {
        const existing = input.id ? get().projects.find((p) => p.id === input.id) : undefined;
        const now = Date.now();
        const project: SavedProject = existing
          ? { ...existing, ...input, files: input.files, updatedAt: now }
          : {
              id: uid("proj"),
              title: input.title,
              conversationId: input.conversationId,
              files: input.files,
              media: input.media,
              createdAt: now,
              updatedAt: now,
            };
        set((s) => ({
          projects: existing
            ? s.projects.map((p) => (p.id === project.id ? project : p))
            : [project, ...s.projects],
        }));
        return project;
      },

      deleteProject: (id) =>
        set((s) => ({
          projects: s.projects.filter((p) => p.id !== id),
        })),

      updateProjectFiles: (id, files) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id ? { ...p, files, updatedAt: Date.now() } : p,
          ),
        })),

      updateProjectMedia: (id, media) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id ? { ...p, media, updatedAt: Date.now() } : p,
          ),
        })),
    }),
    {
      name: "ats-studio-v7",
      version: 7,
      storage: createJSONStorage(() => memoryStorage),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<StudioState>;
        return {
          ...current,
          ...p,
          roster: normalizeRoster(p.roster),
          attachments: normalizeAttachments(p.attachments),
          seatTier: normalizeSeatTiers(p.seatTier),
          seatModel: normalizeSeatModels(p.seatModel),
          activeSeats: normalizeActiveSeats(p.activeSeats),
          power: p.power === "low" || p.power === "max" ? p.power : "mid",
        };
      },
      partialize: (s) =>
        compactState({
          plan: s.plan,
          wallet: s.wallet,
          memory: s.memory,
          referral: s.referral,
          entitlement: s.entitlement,
          roster: s.roster,
          attachments: s.attachments,
          seatTier: s.seatTier,
          seatModel: s.seatModel,
          activeSeats: s.activeSeats,
          power: s.power,
          conversations: s.conversations,
          projects: s.projects,
          activeConversationId: s.activeConversationId,
        }),
    },
  ),
);

export function effectivePlan(state: Pick<StudioState, "plan" | "entitlement">): PlanId {
  if (readOwner()) return "premium";
  const now = Date.now();
  if ((state.entitlement.proUntil ?? 0) > now || (state.entitlement.foundingUntil ?? 0) > now) {
    return state.plan === "premium" ? "premium" : "pro";
  }
  return state.plan;
}

export function activeConversation(state: StudioState): Conversation | undefined {
  return state.conversations.find((c) => c.id === state.activeConversationId);
}

export function activeBranch(convo: Conversation | undefined): Branch | undefined {
  if (!convo) return undefined;
  return convo.branches.find((b) => b.id === convo.activeBranchId) ?? convo.branches[0];
}
