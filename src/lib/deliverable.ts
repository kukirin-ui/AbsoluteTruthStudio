import type { DeliverableKind, VisualSpec } from "./types";
import { inferVideoLength, parseShotLines, type VideoLength } from "./video-plan";
import type { PlanId } from "./types";

const VIDEO_RE =
  /\b(video|reklam\w*|spot|clip|trailer|cinematic|animacij\w*|commercial|after\s*effects|mp4|\d+\s*-?\s*(s|sec|sek|second)s?)\b/i;
const IMAGE_RE =
  /\b(slik\w*|image|poster|logo|thumbnail|illustration|photo|banner|ikona|icon|key\s*visual|still)\b/i;
const APP_RE =
  /\b(app|aplikac\w*|website|web\s*app|frontend|backend|dashboard|landing|saas|ui\b|full\s*stack|full\s*aplik)\b/i;
const BUILD_APP_RE =
  /\b((full|working|complete|radi\w*)\s+)+(web\s*)?(app|aplikac)|\bbuild\s+(me\s+)?(a\s+|an\s+)?(full\s+|working\s+)*app|\bnapravi\s+.*(aplikac|app)|\baplikaciju\b|\bfull\s+working\s+app\b/i;

export function inferDeliverable(prompt: string): DeliverableKind {
  const t = prompt.trim();
  if (!t) return "text";

  const wantsApp = APP_RE.test(t);
  const wantsVideo = VIDEO_RE.test(t);
  const wantsImage = IMAGE_RE.test(t);
  const buildApp = BUILD_APP_RE.test(t);
  const appAsContext =
    /\b(this|the|our|my)\s+app\b/i.test(t) &&
    !/\b(build|napravi|full|working|aplikac|website|dashboard)\b/i.test(t);

  if (buildApp) return "app";
  if (wantsVideo && (!wantsApp || appAsContext)) return "video";
  if (wantsImage && !wantsApp) return "image";
  if (wantsApp) return "app";
  if (wantsVideo) return "video";
  if (wantsImage) return "image";
  return "text";
}

export function inferDuration(prompt: string, plan: PlanId = "free"): VideoLength {
  return inferVideoLength(prompt, plan);
}

export function inferAspect(prompt: string): VisualSpec["aspect"] {
  if (/\b(9\s*[:/]\s*16|vertical|stories|reel|tiktok|phone)\b/i.test(prompt)) return "9:16";
  if (/\b(1\s*[:/]\s*1|square|logo)\b/i.test(prompt)) return "1:1";
  return "16:9";
}

export function extractVisualSpec(visual: string, fallbackPrompt: string, plan: PlanId = "free"): VisualSpec {
  const fallbackKind = inferDeliverable(fallbackPrompt);
  const rawKind = visual.match(/DELIVERABLE:\s*(image|video|app|text)/i)?.[1]?.toLowerCase() as
    | DeliverableKind
    | undefined;
  const durationRaw = Number(
    visual.match(/DURATION:\s*(\d+)/i)?.[1] ?? inferVideoLength(fallbackPrompt, plan),
  );
  const aspectRaw = visual.match(/ASPECT:\s*(16:9|9:16|1:1)/i)?.[1] as VisualSpec["aspect"] | undefined;
  const promptLine =
    visual.match(/PROMPT:\s*(.+)$/im)?.[1]?.trim() ||
    visual
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 40) ||
    fallbackPrompt;

  let deliverable: DeliverableKind = rawKind ?? fallbackKind;
  if (fallbackKind === "video" || fallbackKind === "image" || fallbackKind === "app") {
    deliverable = fallbackKind;
  }

  return {
    deliverable,
    prompt: promptLine.replace(/\s+/g, " ").slice(0, 1200),
    duration: inferVideoLength(String(durationRaw) + "s " + fallbackPrompt, plan),
    aspect: aspectRaw ?? inferAspect(fallbackPrompt),
    shots: parseShotLines(visual),
  };
}

export function pluginIdForKind(kind: DeliverableKind) {
  if (kind === "video") return "imagine-video";
  if (kind === "image") return "imagine-image";
  if (kind === "app") return "app-compiler";
  return null;
}