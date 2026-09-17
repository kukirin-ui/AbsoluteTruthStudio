import type { AgentId, PlanId } from "./types";
import { extraVideoCost, VIDEO_LIMITS, type VideoLength } from "./video-plan";

export type PluginModel = {
  id: string;
  label: string;
  apiModel: string;
  blurb: string;
  /** Credits spent per still image. */
  imageCost?: number;
  /** Credits spent per clip length. */
  durationCosts?: { 6: number; 10: number };
  packs: { id: string; credits: number; price: string; cents: number }[];
};

export type PluginDef = {
  id: string;
  agentId: AgentId;
  name: string;
  blurb: string;
  kind: "media" | "tool";
  integratePrice: { label: string; cents: number } | null;
  includedIn: PlanId[];
  models: PluginModel[];
};

export const PLUGINS: PluginDef[] = [
  {
    id: "imagine-image",
    agentId: "visual",
    name: "Imagine Image",
    blurb: "Renders a finished still — poster, logo, frame, or ad key visual.",
    kind: "media",
    integratePrice: { label: "$9", cents: 900 },
    includedIn: ["pro", "premium"],
    models: [
      {
        id: "imagine-image-standard",
        label: "Imagine Image",
        apiModel: "grok-imagine-image",
        blurb: "Fast 1K stills. Best for iteration.",
        imageCost: 8,
        packs: [{ id: "img-std-24", credits: 24, price: "$6", cents: 600 }],
      },
      {
        id: "imagine-image-quality",
        label: "Imagine Image Quality",
        apiModel: "grok-imagine-image-quality",
        blurb: "Higher-fidelity stills for hero frames.",
        imageCost: 14,
        packs: [{ id: "img-hq-28", credits: 28, price: "$10", cents: 1000 }],
      },
    ],
  },
  {
    id: "imagine-video",
    agentId: "visual",
    name: "Imagine Video",
    blurb: "Optional Pro+ video plugin — clips with credits. Not available on Free.",
    kind: "media",
    integratePrice: { label: "$19", cents: 1900 },
    includedIn: ["pro", "premium"],
    models: [
      {
        id: "imagine-video-standard",
        label: "Imagine Video",
        apiModel: "grok-imagine-video",
        blurb: "480p spots. Lowest credit burn per second.",
        durationCosts: { 6: 24, 10: 40 },
        packs: [{ id: "vid-std-40", credits: 40, price: "$12", cents: 1200 }],
      },
      {
        id: "imagine-video-15",
        label: "Imagine Video 1.5",
        apiModel: "grok-imagine-video-1.5",
        blurb: "720p cinematic. Use for the final ad.",
        durationCosts: { 6: 32, 10: 52 },
        packs: [{ id: "vid-15-52", credits: 52, price: "$18", cents: 1800 }],
      },
    ],
  },
  {
    id: "kling-video",
    agentId: "visual",
    name: "Kling 3.0",
    blurb: "Premium video seat. The clip people actually ship — faces, camera, physics. 720p Standard or 1080p Pro.",
    kind: "media",
    integratePrice: { label: "$19", cents: 1900 },
    includedIn: ["premium"],
    models: [
      {
        id: "kling-v3-std",
        label: "Kling 3.0",
        apiModel: "kling-v3",
        blurb: "720p. Fast motion, people, camera. Extra packs after included clips.",
        durationCosts: { 6: 28, 10: 46 },
        packs: [{ id: "kling-std-46", credits: 46, price: "$14", cents: 1400 }],
      },
      {
        id: "kling-v3-pro",
        label: "Kling 3.0 Pro",
        apiModel: "kling-v3-pro",
        blurb: "1080p cinematic. Premium default for the finished ad.",
        durationCosts: { 6: 36, 10: 58 },
        packs: [{ id: "kling-pro-58", credits: 58, price: "$20", cents: 2000 }],
      },
    ],
  },
  {
    id: "app-compiler",
    agentId: "coder",
    name: "App Compiler",
    blurb: "Unlocks a full runnable React app in the live preview — UI, frontend, and a working mock backend.",
    kind: "tool",
    integratePrice: { label: "$9", cents: 900 },
    includedIn: ["free", "pro", "premium"],
    models: [],
  },
  {
    id: "live-source",
    agentId: "coder",
    name: "Live Source",
    blurb: "Absolute code visibility plus in-place editing of the shipped files.",
    kind: "tool",
    integratePrice: { label: "$15", cents: 1500 },
    includedIn: ["premium"],
    models: [],
  },
  {
    id: "spec-compiler",
    agentId: "architect",
    name: "Spec Compiler",
    blurb: "Architect writes a tighter data model and constraint map before the others move.",
    kind: "tool",
    integratePrice: { label: "$5", cents: 500 },
    includedIn: ["premium"],
    models: [],
  },
  {
    id: "deep-audit",
    agentId: "security",
    name: "Deep Audit",
    blurb: "Verifier spends extra budget on claim-level flags instead of a surface pass.",
    kind: "tool",
    integratePrice: { label: "$7", cents: 700 },
    includedIn: ["premium"],
    models: [],
  },
];

export type PluginWallet = {
  owned: string[];
  credits: Record<string, number>;
  preferredModel: Record<string, string>;
  includedUsed?: number;
  videoUsed?: Partial<Record<PlanId, number>>;
  imageUsed?: number;
};

export const EMPTY_WALLET: PluginWallet = {
  owned: [],
  credits: {},
  preferredModel: {},
  includedUsed: 0,
  videoUsed: {},
  imageUsed: 0,
};

export function pluginById(id: string) {
  return PLUGINS.find((p) => p.id === id);
}

export function modelById(modelId: string) {
  for (const plugin of PLUGINS) {
    const model = plugin.models.find((m) => m.id === modelId);
    if (model) return { plugin, model };
  }
  return undefined;
}

export function pluginsForAgent(agentId: AgentId) {
  return PLUGINS.filter((p) => p.agentId === agentId);
}

export function isPluginOwned(wallet: PluginWallet, pluginId: string, plan: PlanId) {
  const plugin = pluginById(pluginId);
  if (plugin?.includedIn.includes(plan)) return true;
  return wallet.owned.includes(pluginId);
}

export function creditBalance(wallet: PluginWallet, modelId: string) {
  return wallet.credits[modelId] ?? 0;
}

export function mediaCost(model: PluginModel, duration?: 6 | 10) {
  if (model.durationCosts) return model.durationCosts[duration ?? 6];
  return model.imageCost ?? 0;
}

export function preferredModel(wallet: PluginWallet, pluginId: string): PluginModel | undefined {
  const plugin = pluginById(pluginId);
  if (!plugin || plugin.models.length === 0) return undefined;
  const id = wallet.preferredModel[pluginId];
  return plugin.models.find((m) => m.id === id) ?? plugin.models[0];
}

export function modelForPlan(plan: PlanId, pluginId: string, wallet: PluginWallet): PluginModel | undefined {
  const plugin = pluginById(pluginId);
  if (!plugin || plugin.models.length === 0) return undefined;
  const covered = plugin.models.find((m) => planCoversModel(plan, m.id));
  if (covered) {
    const preferred = wallet.preferredModel[pluginId];
    const pick = plugin.models.find((m) => m.id === preferred && planCoversModel(plan, m.id));
    return pick ?? (plan === "premium" ? plugin.models[plugin.models.length - 1] : covered);
  }
  return preferredModel(wallet, pluginId);
}

export function planCoversModel(plan: PlanId, modelId: string) {
  if (plan === "premium") return true;
  if (plan === "pro") {
    return modelId === "imagine-image-standard" || modelId === "imagine-video-standard";
  }
  return false;
}

export function videoPluginId(_plan: PlanId, _wallet: PluginWallet) {
  return "imagine-video";
}

export type RenderAccess =
  | { ok: true; spend: false; trial?: boolean }
  | { ok: true; spend: true; cost: number }
  | { ok: false; spend: false; cost: number };

export function canRenderMedia(
  plan: PlanId,
  wallet: PluginWallet,
  model: PluginModel,
  duration?: 6 | 10,
): RenderAccess {
  if (planCoversModel(plan, model.id)) return { ok: true, spend: false };
  const cost = mediaCost(model, duration);
  if (creditBalance(wallet, model.id) >= cost) return { ok: true, spend: true, cost };
  const left = Math.max(0, 3 - (wallet.includedUsed ?? 0));
  if (plan === "free" && left > 0) return { ok: true, spend: false, trial: true };
  return { ok: false, spend: false, cost };
}

export function canCompileApp(_plan: PlanId, _wallet: PluginWallet) {
  return true;
}

export function videosUsed(wallet: PluginWallet, plan: PlanId) {
  return wallet.videoUsed?.[plan] ?? 0;
}

export function videoQuotaLeft(plan: PlanId, wallet: PluginWallet) {
  return Math.max(0, VIDEO_LIMITS[plan].included - videosUsed(wallet, plan));
}

export function canRenderVideo(plan: PlanId, wallet: PluginWallet, length: VideoLength, model: PluginModel) {
  if (plan === "free" || VIDEO_LIMITS[plan].included === 0) {
    return { ok: false as const, spend: false as const, reason: "plan" as const, max: VIDEO_LIMITS[plan].max };
  }
  if (length > VIDEO_LIMITS[plan].max) {
    return { ok: false as const, spend: false as const, reason: "duration" as const, max: VIDEO_LIMITS[plan].max };
  }
  if (videosUsed(wallet, plan) < VIDEO_LIMITS[plan].included) {
    return { ok: true as const, spend: false as const };
  }
  const cost = extraVideoCost(length);
  if (creditBalance(wallet, model.id) >= cost) return { ok: true as const, spend: true as const, cost };
  return { ok: false as const, spend: false as const, reason: "quota" as const, cost };
}

export function canEditSource(plan: PlanId, wallet: PluginWallet) {
  return plan === "premium" || isPluginOwned(wallet, "live-source", plan);
}

export type LocalPurchase =
  | { ok: true; kind: "integrate"; pluginId: string }
  | { ok: true; kind: "credits"; pluginId: string; modelId: string; credits: number }
  | { ok: false; error: string };

export async function purchasePlugin(pluginId: string): Promise<LocalPurchase> {
  const plugin = pluginById(pluginId);
  if (plugin && !plugin.integratePrice) return { ok: false, error: "This plugin cannot be purchased." };
  return { ok: true, kind: "integrate", pluginId };
}

export async function purchaseCredits(modelId: string, packId: string): Promise<LocalPurchase> {
  const found = modelById(modelId);
  if (!found) return { ok: false, error: "Unknown plugin model." };
  const pack = found.model.packs.find((p) => p.id === packId);
  if (!pack) return { ok: false, error: "Unknown credit pack." };
  return {
    ok: true,
    kind: "credits",
    pluginId: found.plugin.id,
    modelId,
    credits: pack.credits,
  };
}
