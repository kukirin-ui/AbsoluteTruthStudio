import type { AgentId, PlanId } from "./types";

export type CatalogKind = "agent" | "tool";
export type CatalogTier = "free" | "paid";
export type CatalogWire = "mesh" | "imagine-image" | "imagine-video" | "kling" | "app";
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
  visual: "imagine",
  coder: "chatgpt",
  security: "grok",
};

export const DEFAULT_ATTACHMENTS: Attachments = {
  architect: ["spec-notes", "claude-deepthink"],
  visual: ["copywriter", "gemini-image"],
  coder: ["tailwind-kit", "local-backend", "gpt-canvas"],
  security: ["a11y", "grok-live-search"],
};

export const CATALOG: CatalogItem[] = [
  { id: "claude", name: "Claude", brand: "Anthropic", seats: ["architect"], kind: "agent", tier: "free", price: "$0", cents: 0, blurb: "Default Architect. Structures the brief before anyone else moves.", why: "Best at constraints and sequence.", wire: "mesh", includedIn: ["free", "pro", "premium"] },
  { id: "imagine", name: "Imagine", brand: "xAI", seats: ["visual"], kind: "agent", tier: "free", price: "$0", cents: 0, blurb: "Default Visual. Hands you the still or the clip.", why: "Native renderer in this studio.", wire: "imagine-video", includedIn: ["free", "pro", "premium"], pluginId: "imagine-video" },
  { id: "chatgpt", name: "ChatGPT", brand: "OpenAI", seats: ["coder"], kind: "agent", tier: "free", price: "$0", cents: 0, blurb: "Default Coder. Ships a running React app.", why: "Strong at UI + mock backend in one pass.", wire: "app", includedIn: ["free", "pro", "premium"], pluginId: "app-compiler" },
  { id: "grok", name: "Grok", brand: "xAI", seats: ["security"], kind: "agent", tier: "free", price: "$0", cents: 0, blurb: "Default Verifier. Flags unverified claims. Never hides the answer.", why: "Keeps the mesh honest.", wire: "mesh", includedIn: ["free", "pro", "premium"] },
  { id: "llama", name: "Muse Spark", brand: "Meta", seats: ["architect"], kind: "agent", tier: "free", price: "$0", cents: 0, blurb: "Meta's current model — the successor to Llama, which Meta itself has moved on from.", why: "Formerly Llama. Same Meta seat, Meta's actual current model.", wire: "mesh", includedIn: ["free", "pro", "premium"] },
  { id: "gemini", name: "Gemini", brand: "Google", seats: ["architect"], kind: "agent", tier: "free", price: "$0", cents: 0, blurb: "Multimodal Architect. Good at mixed image + copy briefs.", why: "Use when the brief is visual from the first line.", wire: "mesh", includedIn: ["free", "pro", "premium"] },
  { id: "mistral", name: "Mistral", brand: "Mistral", seats: ["architect"], kind: "agent", tier: "free", price: "$0", cents: 0, blurb: "Tight Architect. Short specs, no fluff.", why: "Cuts the brief to what Coder and Visual can ship.", wire: "mesh", includedIn: ["free", "pro", "premium"] },
  { id: "qwen", name: "Qwen", brand: "Alibaba", seats: ["coder"], kind: "agent", tier: "free", price: "$0", cents: 0, blurb: "Coder for dense UI and bilingual copy.", why: "Strong when the app needs Croatian + English.", wire: "app", includedIn: ["free", "pro", "premium"] },
  { id: "deepseek", name: "DeepSeek", brand: "DeepSeek", seats: ["coder"], kind: "agent", tier: "free", price: "$0", cents: 0, blurb: "Coder that prefers working forms over decoration.", why: "Swap in for CRUD-heavy apps.", wire: "app", includedIn: ["free", "pro", "premium"] },
  { id: "grok-coder", name: "Grok Coder", brand: "xAI", seats: ["coder"], kind: "agent", tier: "free", price: "$0", cents: 0, blurb: "Grok in the Coder seat. Direct, no ceremony.", why: "When you want one vendor across Coder and Verifier.", wire: "app", includedIn: ["free", "pro", "premium"] },
  { id: "grok-architect", name: "Grok Architect", brand: "xAI", seats: ["architect"], kind: "agent", tier: "free", price: "$0", cents: 0, blurb: "Grok in the Architect seat.", why: "Same voice from brief to verdict.", wire: "mesh", includedIn: ["free", "pro", "premium"] },
  { id: "claude-verifier", name: "Claude Verifier", brand: "Anthropic", seats: ["security"], kind: "agent", tier: "free", price: "$0", cents: 0, blurb: "Cautious Verifier. Flags weakly sourced claims.", why: "Swap in for legal-adjacent copy.", wire: "mesh", includedIn: ["free", "pro", "premium"] },
  { id: "gemini-verifier", name: "Gemini Verifier", brand: "Google", seats: ["security"], kind: "agent", tier: "free", price: "$0", cents: 0, blurb: "Verifier that prefers primary sources.", why: "Use when the answer cites the live web.", wire: "mesh", includedIn: ["free", "pro", "premium"] },
  { id: "copywriter", name: "Spot Copy", brand: "Studio", seats: ["visual", "architect"], kind: "tool", tier: "free", price: "$0", cents: 0, blurb: "Headline, claim, CTA on every still and clip.", why: "Ads need words on the frame.", wire: "mesh", includedIn: ["free", "pro", "premium"] },
  { id: "spec-notes", name: "Spec Notes", brand: "Studio", seats: ["architect"], kind: "tool", tier: "free", price: "$0", cents: 0, blurb: "Typed data model in the Architect pass.", why: "Stops Coder from inventing fields.", wire: "mesh", includedIn: ["free", "pro", "premium"] },
  { id: "grill-me", name: "Grill Me", brand: "Studio", seats: ["architect"], kind: "tool", tier: "free", price: "$0", cents: 0, blurb: "Interviews you on the brief, one branch at a time, before writing anything.", why: "Fewer wrong turns because the spec was actually nailed down first.", wire: "mesh", includedIn: ["free", "pro", "premium"] },
  { id: "tailwind-kit", name: "Tailwind Kit", brand: "Studio", seats: ["coder"], kind: "tool", tier: "free", price: "$0", cents: 0, blurb: "Forces Tailwind classNames in shipped apps.", why: "Preview runtime already injects Tailwind.", wire: "app", includedIn: ["free", "pro", "premium"] },
  { id: "svg-icons", name: "SVG Icons", brand: "Studio", seats: ["visual", "coder"], kind: "tool", tier: "free", price: "$0", cents: 0, blurb: "Inline SVG instead of icon fonts.", why: "Apps stay offline-complete.", wire: "app", includedIn: ["free", "pro", "premium"] },
  { id: "seo-audit", name: "SEO Audit", brand: "Studio", seats: ["security"], kind: "tool", tier: "free", price: "$0", cents: 0, blurb: "Verifier checks titles, claims, and empty meta.", why: "Landing apps need a real title.", wire: "mesh", includedIn: ["free", "pro", "premium"] },
  { id: "a11y", name: "A11y Check", brand: "Studio", seats: ["security", "coder"], kind: "tool", tier: "free", price: "$0", cents: 0, blurb: "Labels, contrast, keyboard paths on shipped UI.", why: "The app has to be usable.", wire: "app", includedIn: ["free", "pro", "premium"] },
  { id: "json-schema", name: "JSON Schema", brand: "Studio", seats: ["architect"], kind: "tool", tier: "free", price: "$0", cents: 0, blurb: "Architect emits a compact schema before Coder writes.", why: "Keeps mock backend honest.", wire: "mesh", includedIn: ["free", "pro", "premium"] },
  { id: "local-backend", name: "Local Backend", brand: "Studio", seats: ["coder"], kind: "tool", tier: "free", price: "$0", cents: 0, blurb: "localStorage CRUD in every shipped app.", why: "Data survives reload without a server.", wire: "app", includedIn: ["free", "pro", "premium"] },
  { id: "zip-export", name: "ZIP Export", brand: "Studio", seats: ["coder"], kind: "tool", tier: "free", price: "$0", cents: 0, blurb: "One-click ZIP of the live files.", why: "Take the product off this device.", wire: "app", includedIn: ["free", "pro", "premium"] },
  { id: "prompt-memory", name: "Prompt Memory", brand: "Studio", seats: ["architect", "visual", "coder", "security"], kind: "tool", tier: "free", price: "$0", cents: 0, blurb: "4,000-character standing brief per seat.", why: "Agents remember how you work.", wire: "mesh", includedIn: ["free", "pro", "premium"] },
  { id: "markdown-docs", name: "Markdown Docs", brand: "Studio", seats: ["architect", "coder"], kind: "tool", tier: "free", price: "$0", cents: 0, blurb: "Short usage notes in consensus, never as the product.", why: "User needs to know how to use what shipped.", wire: "mesh", includedIn: ["free", "pro", "premium"] },
  { id: "brand-voice", name: "Brand Voice", brand: "Studio", seats: ["visual", "architect"], kind: "tool", tier: "free", price: "$0", cents: 0, blurb: "Locks tone across still, clip, and UI copy.", why: "Four agents, one voice.", wire: "mesh", includedIn: ["free", "pro", "premium"] },

  // Agent-native plugins — tuned to each model's real strengths, so a seat plays
  // to what that model is actually best at. Free on every plan.
  { id: "claude-deepthink", name: "Deep Think", brand: "Anthropic", seats: ["architect"], kind: "tool", tier: "free", price: "$0", cents: 0, blurb: "Extended-thinking pass before the brief is handed off.", why: "Claude Opus/Fable reason hardest on tight constraints.", wire: "mesh", includedIn: ["free", "pro", "premium"] },
  { id: "claude-artifacts", name: "Artifacts", brand: "Anthropic", seats: ["architect"], kind: "tool", tier: "free", price: "$0", cents: 0, blurb: "Builds a structured deliverable — spec, diagram, or doc — you iterate on.", why: "Claude's native artifact workflow, not chat theater.", wire: "mesh", includedIn: ["free", "pro", "premium"] },
  { id: "gpt-canvas", name: "Code Canvas", brand: "OpenAI", seats: ["coder"], kind: "tool", tier: "free", price: "$0", cents: 0, blurb: "Surgical diffs to the shipped app instead of full rewrites.", why: "GPT's canvas keeps edits targeted and reviewable.", wire: "app", includedIn: ["free", "pro", "premium"] },
  { id: "gpt-tools", name: "Tool Calls", brand: "OpenAI", seats: ["coder"], kind: "tool", tier: "free", price: "$0", cents: 0, blurb: "Typed function/tool calls for wiring real APIs into the app.", why: "GPT leads on structured tool orchestration.", wire: "app", includedIn: ["free", "pro", "premium"] },
  { id: "gemini-image", name: "Gemini Image", brand: "Google", seats: ["visual"], kind: "tool", tier: "free", price: "$0", cents: 0, blurb: "Generate and edit stills in-line (Gemini's native image path).", why: "Gemini's text-in / image-out — the 'nano banana' capability.", wire: "mesh", includedIn: ["free", "pro", "premium"] },
  { id: "gemini-ground", name: "Multimodal Read", brand: "Google", seats: ["visual"], kind: "tool", tier: "free", price: "$0", cents: 0, blurb: "Reads an attached image/video and grounds the brief in it.", why: "Gemini leads on mixed image + text understanding.", wire: "mesh", includedIn: ["free", "pro", "premium"] },
  { id: "grok-live-search", name: "Live X Search", brand: "xAI", seats: ["security"], kind: "tool", tier: "free", price: "$0", cents: 0, blurb: "Checks claims against live X and the web in real time.", why: "Grok's native X/web search keeps the verdict current.", wire: "mesh", includedIn: ["free", "pro", "premium"] },
  { id: "grok-sources", name: "Source Grounding", brand: "xAI", seats: ["security"], kind: "tool", tier: "free", price: "$0", cents: 0, blurb: "Attaches a primary source to every flagged claim.", why: "Grok surfaces real-time citations, not stale ones.", wire: "mesh", includedIn: ["free", "pro", "premium"] },

  { id: "kling", name: "Kling 3.0", brand: "Kuaishou", seats: ["visual"], kind: "agent", tier: "paid", price: "$19", cents: 1900, blurb: "People, camera, physics. Premium video seat.", why: "Most-used cinematic tool for ads with faces.", wire: "kling", includedIn: ["premium"], pluginId: "kling-video" },
  { id: "kling-pro", name: "Kling 3.0 Pro", brand: "Kuaishou", seats: ["visual"], kind: "agent", tier: "paid", price: "$20", cents: 2000, blurb: "1080p Kling. Finished spots.", why: "Premium default for the last take.", wire: "kling", includedIn: ["premium"], pluginId: "kling-video" },
  { id: "imagine-quality", name: "Imagine Quality", brand: "xAI", seats: ["visual"], kind: "tool", tier: "paid", price: "$10", cents: 1000, blurb: "Higher-fidelity stills for hero frames.", why: "Posters that have to hold a 16:9 board.", wire: "imagine-image", includedIn: ["premium"], pluginId: "imagine-image" },
  { id: "imagine-15", name: "Imagine Video 1.5", brand: "xAI", seats: ["visual"], kind: "tool", tier: "paid", price: "$18", cents: 1800, blurb: "720p Imagine clips with native audio.", why: "Fast iteration when Kling is not seated.", wire: "imagine-video", includedIn: ["pro", "premium"], pluginId: "imagine-video" },
  { id: "veo", name: "Veo 3.1", brand: "Google", seats: ["visual"], kind: "agent", tier: "paid", price: "$29", cents: 2900, blurb: "Cinematic photoreal video with native sound.", why: "When the spot must look like a film still in motion.", wire: "imagine-video", includedIn: ["premium"] },
  { id: "seedance", name: "Seedance 2.0", brand: "ByteDance", seats: ["visual"], kind: "agent", tier: "paid", price: "$24", cents: 2400, blurb: "Best image-to-video follow-through.", why: "Animate a still you already approved.", wire: "imagine-video", includedIn: ["premium"] },
  { id: "runway", name: "Runway Gen-4", brand: "Runway", seats: ["visual"], kind: "agent", tier: "paid", price: "$28", cents: 2800, blurb: "Director control. Character consistency across shots.", why: "Multi-shot ads that must keep the same face.", wire: "imagine-video", includedIn: ["premium"] },
  { id: "flux", name: "Flux.3", brand: "Black Forest", seats: ["visual"], kind: "agent", tier: "paid", price: "$16", cents: 1600, blurb: "Still specialist. Clean lighting, usable type.", why: "Hero posters and key visuals.", wire: "imagine-image", includedIn: ["premium"] },
  { id: "ideogram", name: "Ideogram", brand: "Ideogram", seats: ["visual"], kind: "agent", tier: "paid", price: "$12", cents: 1200, blurb: "Best-in-class text inside the still.", why: "Logos and end cards with readable type.", wire: "imagine-image", includedIn: ["premium"] },
  { id: "recraft", name: "Recraft", brand: "Recraft", seats: ["visual"], kind: "agent", tier: "paid", price: "$14", cents: 1400, blurb: "Brand-consistent illustration and vector.", why: "UI kits and icon systems.", wire: "imagine-image", includedIn: ["premium"] },
  { id: "hailuo", name: "Hailuo 2.3", brand: "MiniMax", seats: ["visual"], kind: "agent", tier: "paid", price: "$15", cents: 1500, blurb: "Cheap, sharp short clips.", why: "Volume hooks on a budget.", wire: "imagine-video", includedIn: ["premium"] },
  { id: "luma", name: "Luma Ray", brand: "Luma", seats: ["visual"], kind: "agent", tier: "paid", price: "$18", cents: 1800, blurb: "Smooth motion, fast turnaround.", why: "Product spins and B-roll.", wire: "imagine-video", includedIn: ["premium"] },
  { id: "pika", name: "Pika", brand: "Pika", seats: ["visual"], kind: "agent", tier: "paid", price: "$12", cents: 1200, blurb: "Stylized social clips.", why: "9:16 stories and playful spots.", wire: "imagine-video", includedIn: ["premium"] },
  { id: "live-source", name: "Live Source", brand: "Studio", seats: ["coder"], kind: "tool", tier: "paid", price: "$15", cents: 1500, blurb: "Edit the shipped files in place.", why: "You own the code, not a screenshot.", wire: "app", includedIn: ["premium"], pluginId: "live-source" },
  { id: "spec-compiler", name: "Spec Compiler", brand: "Studio", seats: ["architect"], kind: "tool", tier: "paid", price: "$5", cents: 500, blurb: "Typed model and sequence before the others move.", why: "Fewer broken apps.", wire: "mesh", includedIn: ["premium"], pluginId: "spec-compiler" },
  { id: "deep-audit", name: "Deep Audit", brand: "Studio", seats: ["security"], kind: "tool", tier: "paid", price: "$7", cents: 700, blurb: "Claim-level flags instead of a surface pass.", why: "When the copy will be published.", wire: "mesh", includedIn: ["premium"], pluginId: "deep-audit" },
  { id: "github-ship", name: "GitHub Ship", brand: "GitHub", seats: ["coder"], kind: "tool", tier: "paid", price: "$9", cents: 900, blurb: "Bundle ready to push.", why: "Leave the sandbox with a repo, not a zip only.", wire: "app", includedIn: ["pro", "premium"] },
  { id: "voice-tts", name: "Studio Voice", brand: "xAI", seats: ["visual"], kind: "tool", tier: "paid", price: "$8", cents: 800, blurb: "Voiceover notes for the clip.", why: "Ads that speak, not only move.", wire: "mesh", includedIn: ["premium"] },
  { id: "elevenlabs", name: "Voice Cast", brand: "ElevenLabs", seats: ["visual"], kind: "tool", tier: "paid", price: "$22", cents: 2200, blurb: "Cast a voice for the finished spot.", why: "Premium audio for Premium clips.", wire: "mesh", includedIn: ["premium"] },
  { id: "figma-code", name: "Figma to App", brand: "Figma", seats: ["coder", "architect"], kind: "tool", tier: "paid", price: "$19", cents: 1900, blurb: "Turn a layout brief into real screens.", why: "Designer-in, running app-out.", wire: "app", includedIn: ["premium"] },
  { id: "brand-kit", name: "Brand Kit", brand: "Studio", seats: ["visual", "architect"], kind: "tool", tier: "paid", price: "$11", cents: 1100, blurb: "Locks palette, type, and logo rules on every seat.", why: "Four agents, one brand.", wire: "mesh", includedIn: ["pro", "premium"] },
  { id: "analytics-verify", name: "Analytics Verify", brand: "Studio", seats: ["security"], kind: "tool", tier: "paid", price: "$9", cents: 900, blurb: "Verifier checks numbers before they ship.", why: "No invented metrics in consensus.", wire: "mesh", includedIn: ["premium"] },
  { id: "priority-mesh", name: "Priority Mesh", brand: "Studio", seats: ["architect", "visual", "coder", "security"], kind: "tool", tier: "paid", price: "$25", cents: 2500, blurb: "Longer token budget. Four seats stay in lockstep.", why: "Premium consensus does not get cut off.", wire: "mesh", includedIn: ["premium"] },
  { id: "veo-cinema", name: "Veo Cinema", brand: "Google", seats: ["visual"], kind: "tool", tier: "paid", price: "$39", cents: 3900, blurb: "4K-grade cinematic pass on the same brief.", why: "The most expensive look in the catalog.", wire: "imagine-video", includedIn: ["premium"] },
  { id: "midjourney-hero", name: "Hero Still", brand: "Midjourney", seats: ["visual"], kind: "agent", tier: "paid", price: "$24", cents: 2400, blurb: "Art-directed stills for posters and key visuals.", why: "When the frame is the whole product.", wire: "imagine-image", includedIn: ["premium"] },
  { id: "roast-me", name: "Roast Me", brand: "xAI", seats: ["architect", "coder", "security"], kind: "tool", tier: "paid", price: "$5", cents: 500, blurb: "Grok's unfiltered personality, pointed at your idea.", why: "The one seat willing to actually tell you it's bad.", wire: "mesh", includedIn: ["pro", "premium"] },
  { id: "suno-score", name: "Suno Score", brand: "Suno", seats: ["visual"], kind: "tool", tier: "paid", price: "$15", cents: 1500, blurb: "Original scored music for the finished clip.", why: "A real soundtrack, not stock audio.", wire: "mesh", includedIn: ["premium"] },
  { id: "descript-cut", name: "Descript Cut", brand: "Descript", seats: ["visual"], kind: "tool", tier: "paid", price: "$18", cents: 1800, blurb: "Edits the raw generation into a paced final cut.", why: "Footage in, finished edit out.", wire: "mesh", includedIn: ["premium"] },
  { id: "topaz-upscale", name: "Topaz Upscale", brand: "Topaz Labs", seats: ["visual"], kind: "tool", tier: "paid", price: "$14", cents: 1400, blurb: "4K upscale and denoise pass on any render.", why: "Ship at delivery resolution, not draft resolution.", wire: "mesh", includedIn: ["pro", "premium"] },
  { id: "cited-research", name: "Cited Research", brand: "Perplexity", seats: ["security", "architect"], kind: "tool", tier: "paid", price: "$10", cents: 1000, blurb: "Web research with a source attached to every claim.", why: "Nothing in consensus that can't be traced.", wire: "mesh", includedIn: ["pro", "premium"] },
  { id: "notion-sync", name: "Notion Sync", brand: "Notion", seats: ["architect"], kind: "tool", tier: "paid", price: "$7", cents: 700, blurb: "Pushes the spec straight into a Notion doc.", why: "The plan lives where the team already works.", wire: "app", includedIn: ["pro", "premium"] },
  { id: "higgsfield-workspace", name: "Higgsfield Workspace", brand: "Higgsfield", seats: ["visual"], kind: "tool", tier: "paid", price: "$29", cents: 2900, blurb: "One brief, run across 50+ video and image models side by side.", why: "Compare outputs before committing to a final render.", wire: "mesh", includedIn: ["premium"] },
  { id: "vercel-direct", name: "Vercel Direct Deploy", brand: "Vercel", seats: ["coder"], kind: "tool", tier: "paid", price: "$9", cents: 900, blurb: "Ships the build straight to a live preview URL.", why: "A link to click, not just a repo to clone.", wire: "app", includedIn: ["pro", "premium"] },
  { id: "ltx-storyboard", name: "LTX Storyboard", brand: "LTX Studio", seats: ["visual"], kind: "tool", tier: "paid", price: "$21", cents: 2100, blurb: "Full shot-by-shot storyboard before a single frame renders.", why: "Pre-production for the brief, not just one clip.", wire: "mesh", includedIn: ["premium"] },
  { id: "mystic-stock", name: "Mystic Stock", brand: "Freepik", seats: ["visual"], kind: "tool", tier: "paid", price: "$12", cents: 1200, blurb: "Licensed stock blended with AI-generated fill.", why: "Commercial-safe assets when a real photo has to anchor the scene.", wire: "mesh", includedIn: ["pro", "premium"] },
  { id: "framer-handoff", name: "Framer Handoff", brand: "Framer", seats: ["coder", "architect"], kind: "tool", tier: "paid", price: "$16", cents: 1600, blurb: "Publishes the build as an editable Framer site.", why: "A marketing site a non-engineer can still tweak.", wire: "app", includedIn: ["premium"] },
  { id: "long-term-memory", name: "Long-Term Memory", brand: "Pinecone", seats: ["architect"], kind: "tool", tier: "paid", price: "$13", cents: 1300, blurb: "The mesh recalls prior sessions on this project.", why: "Stop re-explaining the brief every time you come back.", wire: "mesh", includedIn: ["premium"] },
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
  const look =
    id &&
    ["veo", "veo-cinema", "runway", "seedance", "flux", "ideogram", "recraft", "hailuo", "luma", "pika", "midjourney-hero"].includes(
      id,
    );
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
    return `- ${seat.toUpperCase()} (${meta.label}) is ${item.name} by ${item.brand}. Framework: ${meta.framework} ${item.blurb}${
      tools ? ` Attached tools: ${tools}.` : ""
    }`;
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

/**
 * Strict split by `kind`. An agent occupies a seat and IS the model doing the
 * work (Claude, Kling, Veo...). A plugin/tool augments whichever agent is
 * already seated (Deep Think, Tailwind Kit, Live X Search...). The two must
 * never share a listing — CATALOG_COUNTS above intentionally does NOT encode
 * this distinction, so anything counting "plugins" must filter by kind, not
 * just tier.
 */
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

/** Paid agent-kind items (Kling, Veo, Runway...) that a seat can be upgraded to — never shown as plugins. */
export function paidAgentsForSeat(seat: AgentId): CatalogItem[] {
  return AGENTS_CATALOG.filter((c) => c.tier === "paid" && c.seats.includes(seat));
}

