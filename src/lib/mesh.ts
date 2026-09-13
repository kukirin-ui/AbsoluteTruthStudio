import {
  DEFAULT_ATTACHMENTS,
  DEFAULT_ROSTER,
  normalizeAttachments,
  normalizeRoster,
  rosterPrompt,
  seatedItem,
  type Attachments,
  type Roster,
} from "@/lib/catalog";
import { extractVisualSpec } from "@/lib/deliverable";
import { lookPrefix } from "@/lib/economics";
import type {
  AgentId,
  AgentStatus,
  AgentTrace,
  PlanId,
  ProjectFile,
  SourceLink,
  StudioMode,
  Verdict,
  VisualSpec,
  WarningInfo,
} from "@/lib/types";

const MESH_MARKERS = ["ARCHITECT", "VISUAL", "CODER", "SECURITY", "CONSENSUS"] as const;
type MeshMarker = (typeof MESH_MARKERS)[number];

export type MeshActive = AgentId | "consensus" | null;

export type ParsedMesh = {
  architect: string;
  visual: string;
  coder: string;
  security: string;
  consensus: string;
  active: MeshActive;
  sources: SourceLink[];
  files: ProjectFile[];
  verdict: Verdict;
  warning?: WarningInfo;
  spec: VisualSpec;
};

const EMPTY: ParsedMesh = {
  architect: "",
  visual: "",
  coder: "",
  security: "",
  consensus: "",
  active: null,
  sources: [],
  files: [],
  verdict: "PENDING",
  spec: {
    deliverable: "text",
    prompt: "",
    duration: 6,
    aspect: "16:9",
    shots: [],
  },
};

function sectionToAgent(section: MeshMarker): MeshActive {
  if (section === "CONSENSUS") return "consensus";
  if (section === "VISUAL") return "visual";
  return section.toLowerCase() as AgentId;
}

function extractVerdict(security: string): Verdict {
  const m = security.match(/VERDICT:\s*(PASS|WARN|BLOCK)/i);
  if (!m) return security.trim() ? "PASS" : "PENDING";
  return m[1]!.toUpperCase() === "PASS" ? "PASS" : "WARN";
}

function extractWarning(security: string): WarningInfo | undefined {
  const why =
    security.match(/WHY:\s*([\s\S]*?)(?:\nFIX:|\nVERDICT:|$)/i)?.[1]?.trim() ??
    security.match(/FLAG(?:GED)?:\s*([\s\S]*?)(?:\nFIX:|\nVERDICT:|$)/i)?.[1]?.trim();
  const fix =
    security.match(/FIX:\s*([\s\S]*?)(?:\nVERDICT:|$)/i)?.[1]?.trim() ??
    "Keep the answer, add sources in your next prompt, or run the mesh again with tighter constraints.";
  if (!why) return undefined;
  return {
    why: why.replace(/\s+/g, " ").slice(0, 480),
    fix: fix.replace(/\s+/g, " ").slice(0, 480),
  };
}

function extractSources(text: string): SourceLink[] {
  const sources: SourceLink[] = [];
  const re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    sources.push({
      title: match[1]!,
      url: match[2]!,
    });
  }
  const bare = /SOURCE:\s*(https?:\/\/\S+)\s*[—-]\s*(.+)/gi;
  while ((match = bare.exec(text))) {
    sources.push({
      title: match[2]!.trim(),
      url: match[1]!,
    });
  }
  const seen = new Set<string>();
  return sources.filter((s) => {
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
}

function defaultPath(lang: string, i: number) {
  if (lang === "html") return i === 0 ? "index.html" : `preview-${i}.html`;
  if (lang === "tsx" || lang === "jsx") return i === 0 ? "src/App.tsx" : `src/components/Screen${i}.tsx`;
  if (lang === "ts" || lang === "typescript") return i === 0 ? "src/lib/data.ts" : `src/lib/mod${i}.ts`;
  if (lang === "javascript" || lang === "js") return `src/lib/mod${i}.js`;
  if (lang === "css") return "src/styles.css";
  if (lang === "json") return "package.json";
  return `src/file-${i}.${lang}`;
}

function pathFromFence(lang: string, hint: string, content: string, i: number) {
  const fromHint = hint.match(/([\w./-]+\.(tsx|ts|jsx|js|css|html|json))/i)?.[1];
  if (fromHint) return fromHint.replace(/^\.\//, "");
  const fromLine = content.match(/^\s*(?:\/\/|#)\s*([\w./-]+\.(tsx|ts|jsx|js|css|html))/);
  if (fromLine?.[1]) return fromLine[1].replace(/^\.\//, "");
  return defaultPath(lang, i);
}

function extractFiles(coder: string): ProjectFile[] {
  const files: ProjectFile[] = [];
  const fence = /```([a-zA-Z0-9]+)?([^\n]*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = fence.exec(coder))) {
    const lang = (match[1] || "txt").toLowerCase();
    if (["md", "markdown"].includes(lang)) {
      i += 1;
      continue;
    }
    const hint = (match[2] || "").trim();
    const content = match[3]!.replace(/\n$/, "");
    const path = pathFromFence(lang, hint, content, i);
    files.push({
      path,
      language: lang === "typescript" ? "ts" : lang,
      content,
    });
    i += 1;
  }
  const seen = new Set<string>();
  return files.filter((f) => {
    if (seen.has(f.path)) return false;
    seen.add(f.path);
    return true;
  });
}

export function parseMesh(raw: string, userPrompt = "", plan: PlanId = "free"): ParsedMesh {
  if (!raw) {
    return {
      ...EMPTY,
      spec: extractVisualSpec("", userPrompt, plan),
    };
  }
  const matches: { section: MeshMarker; index: number }[] = [];
  for (const section of MESH_MARKERS) {
    const token = `<<<${section}>>>`;
    const index = raw.indexOf(token);
    if (index >= 0) matches.push({ section, index });
  }
  if (matches.length === 0) {
    return {
      ...EMPTY,
      consensus: raw.trim(),
      active: "consensus",
      spec: extractVisualSpec("", userPrompt, plan),
    };
  }
  matches.sort((a, b) => a.index - b.index);
  const parsed: ParsedMesh = {
    ...EMPTY,
    architect: "",
    visual: "",
    coder: "",
    security: "",
    consensus: "",
  };
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i]!;
    const start = current.index + `<<<${current.section}>>>`.length;
    const end = i + 1 < matches.length ? matches[i + 1]!.index : raw.length;
    const body = raw.slice(start, end).trim();
    const key = current.section.toLowerCase() as keyof Pick<
      ParsedMesh,
      "architect" | "visual" | "coder" | "security" | "consensus"
    >;
    parsed[key] = body;
    parsed.active = sectionToAgent(current.section);
  }
  parsed.sources = extractSources(parsed.security || parsed.consensus);
  parsed.files = extractFiles(parsed.coder);
  parsed.verdict = extractVerdict(parsed.security);
  parsed.warning = extractWarning(parsed.security);
  parsed.spec = extractVisualSpec(parsed.visual, userPrompt, plan);
  return parsed;
}

export function tracesFromParsed(parsed: ParsedMesh, streaming: boolean): AgentTrace[] {
  const order: AgentId[] = ["architect", "visual", "coder", "security"];
  return order.map((id) => {
    const content = parsed[id];
    let status: AgentStatus = "queued";
    if (content) {
      if (id === "security" && parsed.verdict === "WARN") status = "flagged";
      else if (streaming && parsed.active === id) status = "streaming";
      else if (
        !streaming ||
        (parsed.active &&
          parsed.active !== "consensus" &&
          order.indexOf(id) < order.indexOf(parsed.active as AgentId))
      ) {
        status = id === "security" && parsed.verdict === "WARN" ? "flagged" : "verified";
      } else if (streaming && parsed.active === "consensus") {
        status = id === "security" && parsed.verdict === "WARN" ? "flagged" : "verified";
      } else status = "streaming";
    } else if (streaming) status = parsed.active === id ? "streaming" : "queued";
    else status = "idle";
    return {
      id,
      status,
      content,
    };
  });
}

export type MeshPromptExtras = {
  intent?: "text" | "image" | "video" | "app";
  duration?: number;
  specCompiler?: boolean;
  deepAudit?: boolean;
  memory?: Partial<Record<AgentId, string>>;
  kling?: boolean;
  roster?: Partial<Roster> | Roster;
  attachments?: Partial<Attachments> | Attachments;
  /** Which seats run this turn; idle seats are dropped from the mesh. */
  activeSeats?: Partial<Record<AgentId, boolean>>;
};

const SEAT_PROMPT_LABEL: Record<AgentId, string> = {
  architect: "ARCHITECT",
  visual: "VISUAL",
  coder: "CODER",
  security: "SECURITY",
};

/** Directive that idles the seats the user turned off (min one always runs). */
function activeSeatsDirective(active?: Partial<Record<AgentId, boolean>>): string {
  if (!active) return "";
  const order: AgentId[] = ["architect", "visual", "coder", "security"];
  const on = order.filter((s) => active[s] !== false);
  const off = order.filter((s) => active[s] === false);
  if (off.length === 0 || on.length === 0) return "";
  return `ACTIVE SEATS THIS TURN: only ${on
    .map((s) => SEAT_PROMPT_LABEL[s])
    .join(", ")}. Do NOT output sections for the idle seats (${off
    .map((s) => SEAT_PROMPT_LABEL[s])
    .join(", ")}); the user chose a ${on.length}-agent mesh.`;
}

function lookPrefixNote(visualId: string) {
  const look = lookPrefix(visualId);
  return look
    ? `LOOK PACK for this seat: ${look} Render still happens on Imagine or Kling — do not claim another vendor rendered it.`
    : "";
}

function formatMemory(memory: MeshPromptExtras["memory"], roster: Roster) {
  if (!memory) return "";
  const r = normalizeRoster(roster);
  const rows: string[] = [];
  if (memory.architect?.trim()) {
    rows.push(
      `${seatedItem(r, "architect").name.toUpperCase()} ARCHITECT MEMORY:\n${memory.architect.trim().slice(0, 4000)}`,
    );
  }
  if (memory.visual?.trim()) {
    rows.push(
      `${seatedItem(r, "visual").name.toUpperCase()} VISUAL MEMORY:\n${memory.visual.trim().slice(0, 4000)}`,
    );
  }
  if (memory.coder?.trim()) {
    rows.push(
      `${seatedItem(r, "coder").name.toUpperCase()} CODER MEMORY:\n${memory.coder.trim().slice(0, 4000)}`,
    );
  }
  if (memory.security?.trim()) {
    rows.push(
      `${seatedItem(r, "security").name.toUpperCase()} VERIFIER MEMORY:\n${memory.security.trim().slice(0, 4000)}`,
    );
  }
  if (!rows.length) return "";
  return `USER-AUTHORED AGENT MEMORY — obey these constraints on every turn:\n\n${rows.join("\n\n")}`;
}

export function buildSystemPrompt(mode: StudioMode, plan: PlanId, extras?: MeshPromptExtras) {
  const cite =
    plan === "free"
      ? "Do not include source URLs."
      : "Include empirical source links in SECURITY as markdown [title](url).";
  const intent = extras?.intent ?? "text";
  const duration = extras?.duration ?? (plan === "free" ? 5 : 10);
  const roster = normalizeRoster(extras?.roster ?? DEFAULT_ROSTER);
  const attachments = normalizeAttachments(extras?.attachments ?? DEFAULT_ATTACHMENTS);
  const architect = seatedItem(roster, "architect");
  const visual = seatedItem(roster, "visual");
  const coder = seatedItem(roster, "coder");
  const security = seatedItem(roster, "security");
  const memoryBlock = formatMemory(extras?.memory, roster);
  const shipApp = intent === "app" || (mode === "build" && intent === "text");
  const visualEngine = extras?.kling
    ? `${visual.name} writes the shot list. Kling 3.0 Pro renders the finished clip — faces, camera, physics. If the Kling host is not connected, Imagine Video 1.5 still ships the clip with the same brief.`
    : `${visual.name} writes the shot list. Imagine Video renders the finished clip.`;
  const build = shipApp
    ? `${coder.name} (CODER) ships a COMPLETE React application — not an HTML poster, not a single-file landing page.
Required fenced files. The path MUST sit on the opening fence line:
1. \`\`\`tsx src/App.tsx
   default export function App. Root with navigation between at least two real screens.
2. \`\`\`tsx src/components/Gallery.tsx
   at least one extracted component.
3. \`\`\`ts src/lib/data.ts
   mock backend: localStorage CRUD. Named exports load/save/create/update/remove.
4. Optional \`\`\`css src/styles.css
Rules:
- import hooks from "react". Local imports only as relative paths that match the fence paths (./components/Gallery, ./lib/data).
- No other npm packages. Inline SVG for icons. Tailwind classNames.
- Visible UI immediately. Working forms. Empty state. Data persists after reload.
- No placeholders, no "coming soon", no lorem, no index.html as the product.
- Never mention APK, native stores, or tell the user to build anything "on their side". The fenced React app IS the product.
- Every export must be valid ESM. Do not leave unclosed fences.`
    : intent === "video"
      ? `${coder.name} (CODER) does NOT ship a React app. The product is the clip. No tsx/ts files.
${visualEngine}`
      : intent === "image"
        ? `${coder.name} (CODER) does NOT ship a React app or a website. The product is the still. No tsx, no ts, no html unless a one-line note.`
        : `${coder.name} (CODER): if no asset is requested, output a brief implementation note only — no large code dumps.`;
  const visualDuration =
    intent === "video"
      ? `DURATION: ${duration}
SHOTS: one line per ${duration <= 5 ? "hook" : "10s beat"} as "SHOT 1 (10s): ..." covering the full ${duration}s.`
      : "DURATION: 0";
  const talk =
    mode === "talk" && intent === "text"
      ? `TALK TO ME (CONSENSUS must obey — this is the user-facing reply):
- Zero greetings. Zero meta fluff. Zero "Happy to help", "Great question", "as an AI", or "as the studio".
- Deliver a technical answer first — no preamble.
- End with exactly one focused follow-up question. Not zero. Not two.
- Do not recap the tabs/seats or narrate the mesh.`
      : "";
  const length =
    plan === "free"
      ? "Keep CONSENSUS concise (≤ 140 words)."
      : plan === "premium"
        ? "CONSENSUS may be thorough. Prefer precision over length."
        : "CONSENSUS should be complete but tight.";
  const lookNote = lookPrefixNote(roster.visual);
  const specNote = extras?.specCompiler
    ? "Spec Compiler is on: Architect must output a compact typed data model, constraints, and sequence before anyone else proceeds."
    : "";
  const auditNote = extras?.deepAudit
    ? "Deep Audit is on: Security must flag claim-by-claim. Still never hide the answer."
    : "";
  return `You are Absolute Truth Studio's four-agent mesh. Four DISTINCT seat frameworks ALWAYS write in lockstep — never mirrored personas, never identical boilerplate. They never skip a seat. They never work in isolation. The user gets the actual product — a verified answer, a still, a real clip, or a running React app. Never invent facts, papers, numbers, APIs, or URLs. If unknown, say so.

SEATED NOW (use these names, tools, and frameworks; still output the marker format below):
${rosterPrompt(roster, attachments)}
${activeSeatsDirective(extras?.activeSeats)}

${memoryBlock}

You MUST output in this exact marker format, in this order, with no text before the first marker. Every seat writes with its OWN section markers and job. ${architect.name} (Architecture) hands the brief to ${visual.name} (Visual/UI), who hands the visual spec to ${coder.name} (Coder), who hands the product to ${security.name} (Verifier/Security), who hands the verdict to CONSENSUS.

${talk}

<<<ARCHITECT>>>
ARCHITECTURE FRAMEWORK — ${architect.name} only. Unique job: structure, constraints, sequence, and typed handoff.
- Output: problem framing · constraints · ordered steps · data/model notes (if Spec Notes / Spec Compiler attached).
- Forbidden: UI copy, shot lists, code fences, verdicts, self-intro.
- Hand off a brief ${visual.name} and ${coder.name} can execute without guessing fields.
${specNote}

<<<VISUAL>>>
VISUAL/UI FRAMEWORK — ${visual.name} only. Look: ${visual.why}. Unique job: visual brief and identity lock — never code.
Always include these fields exactly:
DELIVERABLE: ${intent === "text" ? "text|image|video|app (pick one)" : intent}
${visualDuration}
ASPECT: 16:9 or 9:16 or 1:1
PROMPT: one dense English generation prompt. Name the EXACT make and model the user asked for. Never substitute a similar product (wrong brand, form factor, or generation). Lock that subject across every SHOT — same object, same color, same markings. If the user attached a reference photo, that photo IS the product — match it. If the product is unknown, say unknown; do not invent a stand-in brand.
- Forbidden: React/TSX fences, architecture essays, security verdicts, self-intro.
${lookNote}

<<<CODER>>>
CODER FRAMEWORK — ${coder.name} only. Unique job: shippable modules or a tight implementation note.
${build}
- Forbidden: rewriting the visual PROMPT as marketing prose, inventing sources, self-intro.
- Do not mirror Architecture or Visual section shape. Code or a one-line note only.

<<<SECURITY>>>
VERIFIER/SECURITY FRAMEWORK — ${security.name} only. Unique job: empirical check + honest verdict.
${security.name} fact-checks the above. ${cite} ${auditNote}
- Output shape differs from every other seat: flags, sources (when allowed), then WHY/FIX/VERDICT.
- NEVER block, hide, or rewrite-away the user's answer. If something is unverified, FLAG it and tell the user how to proceed.
- Forbidden: shipping app code, inventing shot lists, self-intro.
If everything checks out, end with:
VERDICT: PASS
If anything is unverified, end with:
WHY: <plain-language reason>
FIX: <what the user should change, or that they can keep the answer and continue>
VERDICT: WARN

<<<CONSENSUS>>>
The user-facing result only. ${length}
Rules for CONSENSUS:
- Deliver the thing. Do not introduce the agents. Do not name ${architect.name}, ${visual.name}, ${coder.name}, ${security.name}, or "the mesh".
- Do not recap who did what. No "as the architect…".
${mode === "talk" && intent === "text" ? "- Talk mode: technical answer only, then exactly one follow-up question. No greetings or meta." : ""}
- If the product is an app, describe how to use what is already running in the preview — not a future plan. Never mention APK or native builds.
- If the product is an image, the still IS the product. Do not invent a gallery app around it.
- If the product is a video, the clip IS the product.
- If the product is an image or video, write the spot copy (headline, claim, CTA) as if the frame is already on screen.
- ALWAYS include CONSENSUS even when VERDICT is WARN.
- Do not mention the marker format.

Rules:
- Never refuse the task for "hallucination". Warn, then deliver.
- Conversations continue until the user stops.
- Never claim a separate vendor API. Visual rendering uses the studio Imagine/Kling host. Seated looks (Veo, Flux, Runway, Ideogram, …) change the brief, not the host. Say so if asked.
- Apps must be real React apps. Videos must match the requested duration.
- If the user attached a photo or frame, that identity wins over a text guess.`;
}

export function tracesIdle(): AgentTrace[] {
  return [
    { id: "architect", status: "idle", content: "" },
    { id: "visual", status: "idle", content: "" },
    { id: "coder", status: "idle", content: "" },
    { id: "security", status: "idle", content: "" },
  ];
}

export function tracesQueued(): AgentTrace[] {
  return [
    { id: "architect", status: "queued", content: "" },
    { id: "visual", status: "queued", content: "" },
    { id: "coder", status: "queued", content: "" },
    { id: "security", status: "queued", content: "" },
  ];
}

/** Product seat UI labels (F1): IDLE · LIVE · RENDER PAUSED */
export type SeatUiLabel = "IDLE" | "LIVE" | "RENDER PAUSED";

export function seatUiLabel(status: AgentStatus): SeatUiLabel {
  if (status === "render_paused") return "RENDER PAUSED";
  if (status === "streaming") return "LIVE";
  return "IDLE";
}

/** When the video/still path is paused or failed, Visual seat must not fake LIVE. */
export function withRenderPaused(traces: AgentTrace[], paused: boolean): AgentTrace[] {
  if (!paused) return traces;
  return traces.map((t) =>
    t.id === "visual" && t.status !== "streaming" ? { ...t, status: "render_paused" as const } : t,
  );
}

export type StreamMeshRequest = {
  mode?: StudioMode | string;
  plan?: PlanId | string;
  intent?: string;
  duration?: number;
  specCompiler?: boolean;
  deepAudit?: boolean;
  memory?: Partial<Record<AgentId, string>>;
  roster?: Partial<Roster> | Roster;
  attachments?: Partial<Attachments> | Attachments;
  /** Lead model tier (basic|standard|high|max) — clamped to plan server-side. */
  tier?: string;
  /** Output power low|mid|max. */
  power?: string;
  /** Which of the four seats run this turn (idle seats are omitted). */
  activeSeats?: Partial<Record<AgentId, boolean>>;
  messages?: { role?: string; content?: string }[];
};

/** Client-side 402 from /api/mesh funding gate — do not spoof credits to bypass. */
export class MeshPaymentRequiredError extends Error {
  readonly code = "PAYMENT_REQUIRED" as const;
  readonly status = 402;
  readonly creditCents: number;
  readonly hasByok: boolean;

  constructor(opts: { message?: string; creditCents?: number; hasByok?: boolean }) {
    super(opts.message || "Payment required: add credits or connect a BYOK key");
    this.name = "MeshPaymentRequiredError";
    this.creditCents = Number.isFinite(opts.creditCents)
      ? Math.max(0, Math.trunc(opts.creditCents as number))
      : 0;
    this.hasByok = opts.hasByok === true;
  }
}

export function isMeshPaymentRequiredError(err: unknown): err is MeshPaymentRequiredError {
  return (
    err instanceof MeshPaymentRequiredError ||
    (err instanceof Error &&
      (err as { code?: string }).code === "PAYMENT_REQUIRED" &&
      (err as { status?: number }).status === 402)
  );
}

export async function* streamMesh(req: StreamMeshRequest, signal?: AbortSignal) {
  const res = await fetch("/api/mesh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok) {
    let message = `Mesh error ${res.status}`;
    let code: string | undefined;
    let creditCents = 0;
    let hasByok = false;
    try {
      const body = (await res.json()) as {
        error?: string;
        code?: string;
        details?: { creditCents?: number; hasByok?: boolean };
      };
      if (body.error) message = body.error;
      code = body.code;
      if (body.details && typeof body.details === "object") {
        if (typeof body.details.creditCents === "number") creditCents = body.details.creditCents;
        if (typeof body.details.hasByok === "boolean") hasByok = body.details.hasByok;
      }
    } catch {
      /* ignore */
    }
    if (res.status === 402 || code === "PAYMENT_REQUIRED") {
      throw new MeshPaymentRequiredError({ message, creditCents, hasByok });
    }
    throw new Error(message);
  }
  if (!res.body) throw new Error("Mesh stream unavailable");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulated = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const delta =
          (JSON.parse(data) as { choices?: { delta?: { content?: string } }[] }).choices?.[0]?.delta
            ?.content ?? "";
        if (delta) {
          accumulated += delta;
          yield accumulated;
        }
      } catch {
        /* ignore partial SSE */
      }
    }
  }
}
