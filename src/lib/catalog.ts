import type { AgentId, PlanId } from "./types";

export type CatalogKind = "agent" | "tool" | "orchestrator";
export type CatalogTier = "free" | "paid";
export type CatalogWire = "mesh" | "imagine-image" | "imagine-video" | "kling" | "app" | "orchestrator";
export type Roster = Record<AgentId, string>;
export type Attachments = Record<AgentId, string[]>;

export type CatalogItem = {
  id: string;
  name: string;
  brand: string;
  seats: AgentId[];
  kind: CatalogKind;
  tier: CatalogTier;
  price: string;
  cents: number;
  blurb: string;
  why: string;
  wire: CatalogWire;
  includedIn: PlanId[];
  pluginId?: string;
};

export const SEAT_ORDER: AgentId[] = ["architect", "visual", "coder", "security"];

export const SEAT_META: Record<
  AgentId,
  { label: string; role: string; framework: string; accent: string; glow: string }
> = {
  architect: {
    label: "Architecture",
    role: "Structures constraints & sequence",
    framework: "Decompose → typed constraints → handoff brief. Never ship UI or pixels.",
    accent: "bg-indigo",
    glow: "rgb(99_102_241)",
  },
  visual: {
    label: "Visual/UI",
    role: "Frames, stills & motion brief",
    framework: "DELIVERABLE · ASPECT · PROMPT · SHOTS. Identity lock; no code fences.",
    accent: "bg-emerald",
    glow: "rgb(16_185_129)",
  },
  coder: {
    label: "Coder",
    role: "Ships running React modules",
    framework: "Fenced sources with paths. Working forms + localStorage. No placeholders.",
    accent: "bg-indigo-glow",
    glow: "rgb(129_140_248)",
  },
  security: {
    label: "Verifier/Security",
    role: "Fact-check & verdict",
    framework: "Claim audit → WHY/FIX → VERDICT PASS|WARN. Never hide the answer.",
    accent: "bg-warn",
    glow: "rgb(245_158_11)",
  },
};

export const DEFAULT_ROSTER: Roster = {
  architect: "claude",
  visual: "gemini",
  coder: "chatgpt",
  security: "grok",
};

export const DEFAULT_ATTACHMENTS: Attachments = {
  architect: ["spec-notes", "deep-think"],
  visual: ["nano-banana", "multimodal-read"],
  coder: ["tailwind-kit", "local-backend", "code-canvas"],
  security: ["a11y-check", "source-grounding"],
};

export const CATALOG: CatalogItem[] = [
  // ── CORE AGENTS (8) ───────────────────────────────────────────────────────
  { id: "claude", name: "Claude", brand: "Anthropic", seats: ["architect"], kind: "agent", tier: "free", price: "$0", cents: 0, blurb: "Default Architect. Structures the brief before anyone else moves.", why: "Best at constraints and sequence.", wire: "mesh", includedIn: ["free", "starter", "pro", "premium"] },
  { id: "chatgpt", name: "ChatGPT", brand: "OpenAI", seats: ["coder"], kind: "agent", tier: "free", price: "$0", cents: 0, blurb: "Default Coder. Ships a running React app.", why: "Strong at UI + mock backend in one pass.", wire: "app", includedIn: ["free", "starter", "pro", "premium"] },
  { id: "grok", name: "Grok", brand: "xAI", seats: ["security"], kind: "agent", tier: "free", price: "$0", cents: 0, blurb: "Default Verifier. Flags unverified claims. Never hides the answer.", why: "Keeps the mesh honest.", wire: "mesh", includedIn: ["free", "starter", "pro", "premium"] },
  { id: "gemini", name: "Gemini", brand: "Google", seats: ["visual", "architect"], kind: "agent", tier: "free", price: "$0", cents: 0, blurb: "Multimodal Architect & Visual renderer.", why: "Use when the brief is visual from the first line.", wire: "mesh", includedIn: ["free", "starter", "pro", "premium"] },
  { id: "mistral", name: "Mistral", brand: "Mistral", seats: ["architect"], kind: "agent", tier: "free", price: "$0", cents: 0, blurb: "Tight Architect. Short specs, no fluff.", why: "Cuts the brief to what Coder and Visual can ship.", wire: "mesh", includedIn: ["free", "starter", "pro", "premium"] },
  { id: "qwen", name: "Qwen", brand: "Alibaba", seats: ["coder"], kind: "agent", tier: "free", price: "$0", cents: 0, blurb: "Coder for dense UI and bilingual copy.", why: "Strong when the app needs Croatian + English.", wire: "app", includedIn: ["free", "starter", "pro", "premium"] },
  { id: "deepseek", name: "DeepSeek", brand: "DeepSeek", seats: ["coder"], kind: "agent", tier: "free", price: "$0", cents: 0, blurb: "Coder that prefers working forms over decoration.", why: "Swap in for CRUD-heavy apps.", wire: "app", includedIn: ["free", "starter", "pro", "premium"] },
  { id: "muse", name: "Muse Spark", brand: "Meta", seats: ["architect"], kind: "agent", tier: "free", price: "$0", cents: 0, blurb: "Meta's current model. The successor to Llama.", why: "Formerly Llama. Same Meta seat, Meta's actual current model.", wire: "mesh", includedIn: ["free", "starter", "pro", "premium"] },

  // ── THE ORCHESTRATOR (1) ──────────────────────────────────────────────────
  { id: "kira", name: "Kira", brand: "Sovereign", seats: [], kind: "orchestrator", tier: "free", price: "$0", cents: 0, blurb: "The sovereign intelligence. Routes, gates, synthesizes. Rules the Trinity.", why: "Ensures verified output with zero wasted computation. Your direct interface.", wire: "orchestrator", includedIn: ["free", "starter", "pro", "premium"] },

  // ── FREE PLUGINS (15) ─────────────────────────────────────────────────────
  { id: "nano-banana", name: "Nano Banana", brand: "Google", seats: ["visual"], kind: "tool", tier: "free", price: "$0", cents: 0, blurb: "Generate and edit stills in-line — Gemini's native image model.", why: "Text-in / image-out without leaving the mesh.", wire: "mesh", includedIn: ["free", "starter", "pro", "premium"] },
  { id: "spec-notes", name: "Spec Notes", brand: "Studio", seats: ["architect"], kind: "tool", tier: "free", price: "$0", cents: 0, blurb: "Typed data model in the Architect pass.", why: "Stops Coder from inventing fields.", wire: "mesh", includedIn: ["free", "starter", "pro", "premium"] },
  { id: "deep-think", name: "Deep Think", brand: "Anthropic", seats: ["architect"], kind: "tool", tier: "free", price: "$0", cents: 0, blurb: "Extended-thinking pass before the brief is handed off.", why: "Claude reasons hardest on tight constraints.", wire: "mesh", includedIn: ["free", "starter", "pro", "premium"] },
  { id: "tailwind-kit", name: "Tailwind Kit", brand: "Studio", seats: ["coder"], kind: "tool", tier: "free", price: "$0", cents: 0, blurb: "Forces Tailwind classNames in shipped apps.", why: "Preview runtime already injects Tailwind.", wire: "app", includedIn: ["free", "starter", "pro", "premium"] },
  { id: "local-backend", name: "Local Backend", brand: "Studio", seats: ["coder"], kind: "tool", tier: "free", price: "$0", cents: 0, blurb: "localStorage CRUD in every shipped app.", why: "Data survives reload without a server.", wire: "app", includedIn: ["free", "starter", "pro", "premium"] },
  { id: "code-canvas", name: "Code Canvas", brand: "OpenAI", seats: ["coder"], kind: "tool", tier: "free", price: "$0", cents: 0, blurb: "Surgical diffs to the shipped app instead of full rewrites.", why: "GPT's canvas keeps edits targeted and reviewable.", wire: "app", includedIn: ["free", "starter", "pro", "premium"] },
  { id: "tool-calls", name: "Tool Calls", brand: "OpenAI", seats: ["coder"], kind: "tool", tier: "free", price: "$0", cents: 0, blurb: "Typed function/tool calls for wiring real APIs into the app.", why: "GPT leads on structured tool orchestration.", wire: "app", includedIn: ["free", "starter", "pro", "premium"] },
  { id: "multimodal-read", name: "Multimodal Read", brand: "Google", seats: ["visual"], kind: "tool", tier: "free", price: "$0", cents: 0, blurb: "Reads an attached image/video and grounds the brief in it.", why: "Gemini leads on mixed image + text understanding.", wire: "mesh", includedIn: ["free", "starter", "pro", "premium"] },
  { id: "source-grounding", name: "Source Grounding", brand: "Studio", seats: ["security"], kind: "tool", tier: "free", price: "$0", cents: 0, blurb: "Automatically attaches primary sources to flagged claims.", why: "Keeps the verdict current and evidence-based.", wire: "mesh", includedIn: ["free", "starter", "pro", "premium"] },
  { id: "a11y-check", name: "A11y Check", brand: "Studio", seats: ["security", "coder"], kind: "tool", tier: "free", price: "$0", cents: 0, blurb: "Labels, contrast, keyboard paths on shipped UI.", why: "The app has to be usable by everyone.", wire: "app", includedIn: ["free", "starter", "pro", "premium"] },
  { id: "svg-icons", name: "SVG Icons", brand: "Studio", seats: ["visual", "coder"], kind: "tool", tier: "free", price: "$0", cents: 0, blurb: "Inline SVG instead of icon fonts.", why: "Apps stay offline-complete and lightweight.", wire: "app", includedIn: ["free", "starter", "pro", "premium"] },
  { id: "prompt-memory", name: "Prompt Memory", brand: "Studio", seats: ["architect", "visual", "coder", "security"], kind: "tool", tier: "free", price: "$0", cents: 0, blurb: "4,000-character standing brief per seat.", why: "Agents remember how you work across sessions.", wire: "mesh", includedIn: ["free", "starter", "pro", "premium"] },
  { id: "brand-voice", name: "Brand Voice", brand: "Studio", seats: ["visual", "architect"], kind: "tool", tier: "free", price: "$0", cents: 0, blurb: "Locks tone across still, clip, and UI copy.", why: "Four agents, one consistent voice.", wire: "mesh", includedIn: ["free", "starter", "pro", "premium"] },
  { id: "markdown-docs", name: "Markdown Docs", brand: "Studio", seats: ["architect", "coder"], kind: "tool", tier: "free", price: "$0", cents: 0, blurb: "Short usage notes in consensus, never as the product.", why: "User needs to know how to use what shipped.", wire: "mesh", includedIn: ["free", "starter", "pro", "premium"] },
  { id: "zip-export", name: "ZIP Export", brand: "Studio", seats: ["coder"], kind: "tool", tier: "free", price: "$0", cents: 0, blurb: "One-click ZIP of the live files.", why: "Take the product off this device instantly.", wire: "app", includedIn: ["free", "starter", "pro", "premium"] },

  // ── PAID PLUGINS (15) ─────────────────────────────────────────────────────
  // Purchased exclusively via Credit Top-ups. Not included in subscription.
  { id: "higgsfield-workspace", name: "Higgsfield Workspace", brand: "Higgsfield", seats: ["visual"], kind: "tool", tier: "paid", price: "$29", cents: 2900, blurb: "Advanced video/3D workspace for complex, controlled scenes.", why: "Top-tier control over generative video.", wire: "mesh", includedIn: [] },
  { id: "grill-me", name: "Grill Me / Roast Me", brand: "Grok", seats: ["architect", "coder", "security"], kind: "tool", tier: "paid", price: "$5", cents: 500, blurb: "Brutal, unfiltered critique of your shipped code or design.", why: "The one seat willing to actually tell you it's bad. Pure truth.", wire: "mesh", includedIn: [] },
  { id: "kling-pro", name: "Kling 3.0 Pro", brand: "Kuaishou", seats: ["visual"], kind: "tool", tier: "paid", price: "$20", cents: 2000, blurb: "1080p Kling. Finished cinematic spots.", why: "Premium default for the final take with faces and physics.", wire: "kling", includedIn: [] },
  { id: "veo", name: "Veo 3.1", brand: "Google", seats: ["visual"], kind: "tool", tier: "paid", price: "$29", cents: 2900, blurb: "Cinematic photoreal video with native sound.", why: "When the spot must look like a film still in motion.", wire: "imagine-video", includedIn: [] },
  { id: "runway", name: "Runway Gen-4", brand: "Runway", seats: ["visual"], kind: "tool", tier: "paid", price: "$28", cents: 2800, blurb: "Director control. Character consistency across shots.", why: "Multi-shot ads that must keep the same face.", wire: "imagine-video", includedIn: [] },
  { id: "flux", name: "Flux.3", brand: "Black Forest", seats: ["visual"], kind: "tool", tier: "paid", price: "$16", cents: 1600, blurb: "Still specialist. Clean lighting, usable type.", why: "Hero posters and key visuals.", wire: "imagine-image", includedIn: [] },
  { id: "ideogram", name: "Ideogram", brand: "Ideogram", seats: ["visual"], kind: "tool", tier: "paid", price: "$12", cents: 1200, blurb: "Best-in-class text inside the still.", why: "Logos and end cards with readable, perfect type.", wire: "imagine-image", includedIn: [] },
  { id: "live-source", name: "Live Source", brand: "Studio", seats: ["coder"], kind: "tool", tier: "paid", price: "$15", cents: 1500, blurb: "Edit the shipped files in place.", why: "You own the code, not just a screenshot.", wire: "app", includedIn: [] },
  { id: "spec-compiler", name: "Spec Compiler", brand: "Studio", seats: ["architect"], kind: "tool", tier: "paid", price: "$10", cents: 1000, blurb: "Typed model and sequence before the others move.", why: "Zero structural errors before coding begins.", wire: "mesh", includedIn: [] },
  { id: "deep-audit", name: "Deep Audit", brand: "Studio", seats: ["security"], kind: "tool", tier: "paid", price: "$15", cents: 1500, blurb: "Claim-level flags instead of a surface pass.", why: "Microscopic verification for enterprise standards.", wire: "mesh", includedIn: [] },
  { id: "github-ship", name: "GitHub Ship", brand: "GitHub", seats: ["coder"], kind: "tool", tier: "paid", price: "$10", cents: 1000, blurb: "Bundle ready to push with commit history.", why: "Leave the sandbox with a repo, not just a zip.", wire: "app", includedIn: [] },
  { id: "voice-cast", name: "Voice Cast", brand: "ElevenLabs", seats: ["visual"], kind: "tool", tier: "paid", price: "$22", cents: 2200, blurb: "Cast a professional voice for the finished spot.", why: "Premium audio for premium clips.", wire: "mesh", includedIn: [] },
  { id: "figma-code", name: "Figma to App", brand: "Figma", seats: ["coder", "architect"], kind: "tool", tier: "paid", price: "$20", cents: 2000, blurb: "Turn a layout brief into real, running screens.", why: "Designer-in, running app-out in one step.", wire: "app", includedIn: [] },
  { id: "brand-kit", name: "Brand Kit", brand: "Studio", seats: ["visual", "architect"], kind: "tool", tier: "paid", price: "$15", cents: 1500, blurb: "Locks palette, type, and logo rules on every seat.", why: "Absolute brand consistency in every pixel.", wire: "mesh", includedIn: [] },
  { id: "cited-research", name: "Cited Research", brand: "Perplexity", seats: ["security", "architect"], kind: "tool", tier: "paid", price: "$10", cents: 1000, blurb: "Web research with a source attached to every claim.", why: "Nothing in consensus that can't be traced.", wire: "mesh", includedIn: [] },
];

export function catalogById(id: string) {
  return CATALOG.find((c) => c.id === id);
}

export function catalogForSeat(seat: AgentId) {
  return CATALOG.filter((c) => c.seats.includes(seat));
}

export function agentsForSeat(seat: AgentId) {
  return catalogForSeat(seat).filter((c) => c.kind === "agent");
}

export function toolsForSeat(seat: AgentId) {
  return catalogForSeat(seat).filter((c) => c.kind === "tool");
}

export function seatedItem(roster: Roster, seat: AgentId) {
  return catalogById(roster[seat] ?? DEFAULT_ROSTER[seat]) ?? catalogById(DEFAULT_ROSTER[seat])!;
}

export function catalogOwnKey(item: CatalogItem) {
  return item.pluginId ?? item.id;
}

export function catalogAvailable(item: CatalogItem, plan: PlanId, owned: string[]) {
  if (item.tier === "free") return true;
  if (item.includedIn.includes(plan)) return true;
  const key = catalogOwnKey(item);
  return owned.includes(key) || owned.includes(item.id);
}

export function wireLabel(wire: CatalogWire, id?: string) {
  const look = id && ["veo", "runway", "flux", "ideogram", "kling-pro"].includes(id);
  switch (wire) {
    case "kling":
      return "Optional render plugin · attach when you want it";
    case "imagine-video":
      return look ? "Look pack · studio visual host" : "Studio visual host";
    case "imagine-image":
      return look ? "Look pack · studio stills" : "Studio stills";
    case "app":
      return "Live React app in the preview";
    default:
      return "Four-seat mesh";
  }
}

export function normalizeRoster(raw?: Partial<Roster> | null): Roster {
  const next: Roster = { ...DEFAULT_ROSTER };
  for (const seat of SEAT_ORDER) {
    const id = raw?.[seat];
    const item = id ? catalogById(id) : undefined;
    if (item && item.kind === "agent" && item.seats.includes(seat)) next[seat] = item.id;
  }
  return next;
}

export function normalizeAttachments(raw?: Partial<Attachments> | null): Attachments {
  const next: Attachments = { architect: [], visual: [], coder: [], security: [] };
  for (const seat of SEAT_ORDER) {
    const list = raw?.[seat];
    if (!Array.isArray(list)) {
      next[seat] = [...DEFAULT_ATTACHMENTS[seat]];
      continue;
    }
    next[seat] = list.filter((id) => {
      const item = catalogById(id);
      return Boolean(item && item.kind === "tool" && item.seats.includes(seat));
    });
  }
  return next;
}

export function attachedItems(attachments: Attachments, seat: AgentId) {
  return (attachments[seat] ?? []).map(catalogById).filter((c): c is CatalogItem => Boolean(c));
}

export function rosterPrompt(roster: Roster, attachments: Attachments) {
  return SEAT_ORDER.map((seat) => {
    const item = seatedItem(roster, seat);
    const meta = SEAT_META[seat];
    const tools = attachedItems(attachments, seat)
      .map((t) => `${t.name} (${t.why})`)
      .join("; ");
    return `- ${seat.toUpperCase()} (${meta.label}) is ${item.name} by ${item.brand}. Framework: ${meta.framework} ${item.blurb}${tools ? ` Attached tools: ${tools}.` : ""}`;
  }).join("\n");
}

export function hasAttached(attachments: Attachments, id: string) {
  return SEAT_ORDER.some((seat) => (attachments[seat] ?? []).includes(id));
}

export function isSeated(roster: Roster, id: string) {
  return SEAT_ORDER.some((seat) => roster[seat] === id);
}

export const CATALOG_COUNTS = {
  total: CATALOG.length,
  free: CATALOG.filter((c) => c.tier === "free").length,
  paid: CATALOG.filter((c) => c.tier === "paid").length,
};

export const AGENTS_CATALOG: CatalogItem[] = CATALOG.filter((c) => c.kind === "agent");
export const PLUGINS_CATALOG: CatalogItem[] = CATALOG.filter((c) => c.kind === "tool");

export const AGENT_COUNTS = {
  total: AGENTS_CATALOG.length,
  free: AGENTS_CATALOG.filter((c) => c.tier === "free").length,
  paid: AGENTS_CATALOG.filter((c) => c.tier === "paid").length,
};

export const PLUGIN_COUNTS = {
  total: PLUGINS_CATALOG.length,
  free: PLUGINS_CATALOG.filter((c) => c.tier === "free").length,
  paid: PLUGINS_CATALOG.filter((c) => c.tier === "paid").length,
};

export function paidAgentsForSeat(seat: AgentId): CatalogItem[] {
  return AGENTS_CATALOG.filter((c) => c.tier === "paid" && c.seats.includes(seat));
}