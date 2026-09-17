import { createHmac } from "node:crypto";

export type KlingStart =
  | { ok: true; requestId: string }
  | { ok: false; error: string };

export type KlingStatus =
  | { ok: true; status: "pending" | "running" }
  | { ok: true; status: "done"; url: string }
  | { ok: false; error: string };

function klingDuration(raw?: number) {
  if (!raw) return 10;
  if (raw <= 6) return 5;
  if (raw >= 15) return 15;
  return raw <= 10 ? 10 : Math.min(15, Math.round(raw));
}

function klingJwt(accessKey: string, secretKey: string) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ iss: accessKey, exp: now + 1800, nbf: now - 5 })).toString(
    "base64url",
  );
  const sig = createHmac("sha256", secretKey).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

function officialAuth() {
  const bearer = process.env.KLING_API_KEY?.trim();
  if (bearer) return `Bearer ${bearer}`;
  const ak = process.env.KLING_ACCESS_KEY?.trim();
  const sk = process.env.KLING_SECRET_KEY?.trim();
  if (ak && sk) return `Bearer ${klingJwt(ak, sk)}`;
  return null;
}

function falKey() {
  return process.env.FAL_KEY?.trim() || process.env.FAL_API_KEY?.trim() || "";
}

function aimlKey() {
  return (
    process.env.AIMLAPI_KEY?.trim() ||
    process.env.AIMLAPI_API_KEY?.trim() ||
    process.env.AI_ML_API_KEY?.trim() ||
    ""
  );
}

export function klingConfigured() {
  return Boolean(officialAuth() || falKey() || aimlKey());
}

export async function startKlingJob(input: {
  prompt: string;
  model: string;
  duration?: number;
  aspect?: string;
  image?: string;
}): Promise<KlingStart> {
  const duration = klingDuration(input.duration);
  const aspect = input.aspect === "9:16" || input.aspect === "1:1" ? input.aspect : "16:9";
  const pro = input.model.includes("pro");
  const prompt = input.prompt.slice(0, 2200);
  const image = input.image?.trim();

  const official = officialAuth();
  if (official) {
    const started = await startOfficial(official, prompt, duration, aspect, pro, image);
    if (started.ok) return started;
  }

  const fal = falKey();
  if (fal) {
    const started = await startFal(fal, prompt, duration, aspect, pro, image);
    if (started.ok) return started;
  }

  const aiml = aimlKey();
  if (aiml) {
    const started = await startAiml(aiml, prompt, duration, aspect, pro, image);
    if (started.ok) return started;
  }

  return { ok: false, error: "not-configured" };
}

export async function pollKlingJob(requestId: string): Promise<KlingStatus> {
  const [tag, backend, id] = requestId.split("|");
  if (tag !== "k" || !backend || !id) return { ok: false, error: "Unknown Kling job." };

  if (backend === "off") return pollOfficial(id);
  if (backend === "fal") return pollFal(id);
  if (backend === "aiml") return pollAiml(id);
  return { ok: false, error: "Unknown Kling host." };
}

async function startOfficial(
  auth: string,
  prompt: string,
  duration: number,
  aspect: string,
  pro: boolean,
  image?: string,
): Promise<KlingStart> {
  const hosts = ["https://api-singapore.klingai.com", "https://api.klingai.com"];
  const path = image ? "/v1/videos/image2video" : "/v1/videos/text2video";
  for (const host of hosts) {
    try {
      const body: Record<string, unknown> = {
        model_name: "kling-v3",
        prompt,
        duration: String(duration),
        aspect_ratio: aspect,
        mode: pro ? "pro" : "std",
        sound: "on",
      };
      if (image) body.image = image;
      const res = await fetch(`${host}${path}`, {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { code?: number; data?: { task_id?: string }; task_id?: string };
      const id = json.data?.task_id || json.task_id;
      if (id) return { ok: true, requestId: `k|off|${id}` };
    } catch {
      /* try next host */
    }
  }
  return { ok: false, error: "Kling official host rejected the job." };
}

async function pollOfficial(id: string): Promise<KlingStatus> {
  const auth = officialAuth();
  if (!auth) return { ok: false, error: "Kling is not connected." };
  const hosts = ["https://api-singapore.klingai.com", "https://api.klingai.com"];
  for (const host of hosts) {
    try {
      const res = await fetch(`${host}/v1/videos/text2video/${encodeURIComponent(id)}`, {
        headers: { Authorization: auth },
      });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        data?: {
          task_status?: string;
          task_result?: { videos?: { url?: string }[] };
        };
      };
      const status = String(json.data?.task_status ?? "").toLowerCase();
      if (status === "succeed" || status === "succeeded" || status === "success") {
        const url = json.data?.task_result?.videos?.[0]?.url;
        if (url) return { ok: true, status: "done", url };
        return { ok: false, error: "Kling finished with no file." };
      }
      if (status === "failed" || status === "error") return { ok: false, error: "Kling could not finish the clip." };
      return { ok: true, status: "pending" };
    } catch {
      /* next */
    }
  }
  return { ok: true, status: "pending" };
}

function falPath(pro: boolean, image?: string) {
  if (image) {
    return pro
      ? "fal-ai/kling-video/v2.5-turbo/pro/image-to-video"
      : "fal-ai/kling-video/v2.5-turbo/standard/image-to-video";
  }
  return pro
    ? "fal-ai/kling-video/v2.5-turbo/pro/text-to-video"
    : "fal-ai/kling-video/v2.5-turbo/standard/text-to-video";
}

async function startFal(
  key: string,
  prompt: string,
  duration: number,
  aspect: string,
  pro: boolean,
  image?: string,
): Promise<KlingStart> {
  try {
    const body: Record<string, unknown> = {
      prompt,
      duration: String(duration === 5 ? 5 : 10),
      aspect_ratio: aspect,
    };
    if (image) body.image_url = image;
    const res = await fetch(`https://queue.fal.run/${falPath(pro, image)}`, {
      method: "POST",
      headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { ok: false, error: "Kling (Fal) rejected the job." };
    const json = (await res.json()) as { request_id?: string };
    if (!json.request_id) return { ok: false, error: "Kling (Fal) returned no job." };
    return { ok: true, requestId: `k|fal|${json.request_id}` };
  } catch {
    return { ok: false, error: "Kling (Fal) is unreachable." };
  }
}

async function pollFal(id: string): Promise<KlingStatus> {
  const key = falKey();
  if (!key) return { ok: false, error: "Kling is not connected." };
  try {
    const res = await fetch(`https://queue.fal.run/fal-ai/kling-video/requests/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Key ${key}` },
    });
    if (res.status === 202) return { ok: true, status: "pending" };
    if (!res.ok) return { ok: true, status: "pending" };
    const json = (await res.json()) as { video?: { url?: string }; url?: string; status?: string };
    const url = json.video?.url || json.url;
    if (url) return { ok: true, status: "done", url };
    const status = String(json.status ?? "").toLowerCase();
    if (status === "failed" || status === "error") return { ok: false, error: "Kling could not finish the clip." };
    return { ok: true, status: "pending" };
  } catch {
    return { ok: true, status: "pending" };
  }
}

async function startAiml(
  key: string,
  prompt: string,
  duration: number,
  aspect: string,
  pro: boolean,
  image?: string,
): Promise<KlingStart> {
  try {
    const body: Record<string, unknown> = {
      model: image
        ? pro
          ? "klingai/video-v3-pro-image-to-video"
          : "klingai/video-v3-standard-image-to-video"
        : pro
          ? "klingai/video-v3-pro-text-to-video"
          : "klingai/video-v3-standard-text-to-video",
      prompt,
      duration,
      aspect_ratio: aspect,
    };
    if (image) body.image_url = image;
    const res = await fetch("https://api.aimlapi.com/v2/video/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { ok: false, error: "Kling (AIML) rejected the job." };
    const json = (await res.json()) as { id?: string; generation_id?: string };
    const id = json.id || json.generation_id;
    if (!id) return { ok: false, error: "Kling (AIML) returned no job." };
    return { ok: true, requestId: `k|aiml|${id}` };
  } catch {
    return { ok: false, error: "Kling (AIML) is unreachable." };
  }
}

async function pollAiml(id: string): Promise<KlingStatus> {
  const key = aimlKey();
  if (!key) return { ok: false, error: "Kling is not connected." };
  try {
    const res = await fetch(`https://api.aimlapi.com/v2/video/generations/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return { ok: true, status: "pending" };
    const json = (await res.json()) as {
      status?: string;
      video?: { url?: string };
      video_url?: string;
      error?: { message?: string };
    };
    const status = String(json.status ?? "").toLowerCase();
    if (status === "completed" || status === "succeed" || status === "succeeded" || status === "done") {
      const url = json.video?.url || json.video_url;
      if (url) return { ok: true, status: "done", url };
      return { ok: false, error: "Kling finished with no file." };
    }
    if (status === "failed" || status === "error") {
      return { ok: false, error: json.error?.message || "Kling could not finish the clip." };
    }
    return { ok: true, status: "pending" };
  } catch {
    return { ok: true, status: "pending" };
  }
}

export const KLING_PROXY_HOSTS = [
  "klingai.com",
  "kling.com",
  "fal.media",
  "fal.ai",
  "aimlapi.com",
];
