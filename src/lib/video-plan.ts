import type { PlanId } from "./types";

export type VideoLength = 5 | 10 | 15 | 20 | 30 | 45 | 60;

export type VideoShot = {
  prompt: string;
  apiDuration: 6 | 10;
  playSeconds: number;
};

export const VIDEO_LIMITS: Record<PlanId, { max: VideoLength; included: number; label: string }> = {
  free: { max: 5, included: 0, label: "Pro" },
  starter: { max: 5, included: 0, label: "Pro" },
  pro: { max: 30, included: 6, label: "up to 30s" },
  premium: { max: 60, included: 9, label: "up to 60s" },
};

export const VIDEO_LENGTHS: Record<PlanId, VideoLength[]> = {
  free: [],
  starter: [],
  pro: [10, 15, 20, 30],
  premium: [10, 15, 20, 30, 45, 60],
};

export function clampVideoLength(plan: PlanId, wanted: number): VideoLength {
  const allowed = VIDEO_LENGTHS[plan];
  if (!allowed.length) return 5;
  const max = VIDEO_LIMITS[plan].max;
  const n = Math.min(wanted || max, max);
  return (allowed.find((x) => x >= n) ?? allowed[allowed.length - 1] ?? max) as VideoLength;
}

export function inferVideoLength(prompt: string, plan: PlanId): VideoLength {
  const m = prompt.match(/\b(5|10|15|20|30|45|60)\s*-?\s*(s|sec|sek|second|sekund)/i);
  if (m) return clampVideoLength(plan, Number(m[1]));
  if (/\b(reklam\w*|commercial|ad\b|spot|trailer|cinematic)\b/i.test(prompt)) {
    return clampVideoLength(plan, plan === "free" ? 5 : 10);
  }
  return VIDEO_LIMITS[plan].max === 5 ? 5 : 10;
}

export function planShots(length: VideoLength, prompt: string, shotLines: string[] = []): VideoShot[] {
  if (length <= 5) {
    return [
      {
        prompt: shotLines[0] || `${prompt}. Short clip. One beat, one subject, clear end frame.`,
        apiDuration: 6,
        playSeconds: 5,
      },
    ];
  }
  const count = Math.ceil(length / 10);
  const shots: VideoShot[] = [];
  let left = length;
  for (let i = 0; i < count; i++) {
    const play = Math.min(10, left);
    left -= play;
    const line = shotLines[i]?.trim();
    shots.push({
      prompt:
        line ||
        `${prompt}. Shot ${i + 1} of ${count}, ${play}s. SAME exact subject, make, model, color, and body as shot 1. Distinct camera move only — do not switch products.`,
      apiDuration: play <= 6 ? 6 : 10,
      playSeconds: play,
    });
  }
  return shots;
}

export function parseShotLines(visual: string): string[] {
  const lines: string[] = [];
  const re = /SHOT\s*\d+\s*(?:\(([^)]+)\))?\s*[:.\-–]\s*(.+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(visual))) {
    lines.push(m[2]!.trim());
  }
  return lines;
}

export function extraVideoCost(length: VideoLength) {
  if (length <= 10) return 40;
  if (length <= 30) return 80;
  return 120;
}
