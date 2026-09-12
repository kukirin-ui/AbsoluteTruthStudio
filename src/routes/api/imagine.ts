import { createFileRoute } from "@tanstack/react-router";
import { klingConfigured, KLING_PROXY_HOSTS, pollKlingJob, startKlingJob } from "@/lib/kling-host";

const IMAGE_MODELS = new Set(["grok-imagine-image", "grok-imagine-image-quality"]);
const VIDEO_MODELS = new Set(["grok-imagine-video", "grok-imagine-video-1.5"]);
const KLING_MODELS = new Set(["kling-v3", "kling-v3-pro"]);
const PROXY_HOSTS = new Set([
  "imgen.x.ai",
  "vidgen.x.ai",
  "imagine.x.ai",
  "api.x.ai",
  "data.x.ai",
  "cdn.x.ai",
  ...KLING_PROXY_HOSTS,
]);

type Body = {
  action?: string;
  kind?: string;
  prompt?: string;
  model?: string;
  duration?: number;
  aspect?: string;
  url?: string;
  image?: string;
  references?: string[];
};

function capacity() {
  return Response.json(
    {
      error:
        "Imagine is at capacity right now. Your brief stays on this device — retry, or keep the live HTML cut in the preview.",
    },
    { status: 503 },
  );
}

function authHeader(key: string) {
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

function allowedProxy(url: string) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    return [...PROXY_HOSTS].some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

function pickImageUrl(json: Record<string, unknown>): string | undefined {
  const data = json.data as { url?: string; b64_json?: string }[] | undefined;
  const first = data?.[0];
  if (first?.b64_json) return `data:image/jpeg;base64,${first.b64_json}`;
  if (first?.url) return first.url;
  if (typeof json.url === "string") return json.url;
  return undefined;
}

function pickVideoUrl(json: Record<string, unknown>): string | undefined {
  const video = json.video as { url?: string } | undefined;
  if (video?.url) return video.url;
  if (typeof json.url === "string") return json.url;
  return undefined;
}

function asImageRef(raw?: string) {
  if (!raw) return undefined;
  const v = raw.trim();
  if (!v) return undefined;
  if (v.startsWith("data:image/") || v.startsWith("https://") || v.startsWith("http://")) return { url: v };
  return undefined;
}

function refList(raw?: string[]) {
  if (!Array.isArray(raw)) return [];
  return raw.map(asImageRef).filter((x): x is { url: string } => Boolean(x)).slice(0, 7);
}

export const Route = createFileRoute("/api/imagine")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }

        const apiKey = process.env.XAI_API_KEY;
        const wantsKling = body.kind === "video" && KLING_MODELS.has(body.model ?? "");

        if (body.action === "proxy") {
          if (!body.url || !allowedProxy(body.url)) {
            return Response.json({ error: "Invalid media URL" }, { status: 400 });
          }
          const upstream = await fetch(body.url);
          if (!upstream.ok || !upstream.body) return capacity();
          return new Response(upstream.body, {
            headers: {
              "Content-Type": upstream.headers.get("content-type") || "application/octet-stream",
              "Content-Disposition": "attachment",
              "Cache-Control": "private, max-age=60",
            },
          });
        }

        const prompt = (body.prompt ?? "").trim().slice(0, 1400);
        if (!prompt) return Response.json({ error: "Prompt required" }, { status: 400 });
        const image = asImageRef(body.image);
        const references = refList(body.references);

        if (body.kind === "image") {
          if (!apiKey) {
            return Response.json({ error: "Imagine is not available in this environment." }, { status: 503 });
          }
          const model = IMAGE_MODELS.has(body.model ?? "") ? body.model! : "grok-imagine-image";
          if (image || references.length) {
            const images = [...(image ? [image] : []), ...references].slice(0, 3);
            const xai = await fetch("https://api.x.ai/v1/images/edits", {
              method: "POST",
              headers: authHeader(apiKey),
              body: JSON.stringify({
                model,
                prompt,
                n: 1,
                images,
              }),
            });
            if (xai.status === 401 || xai.status === 403 || xai.status === 429) return capacity();
            if (xai.ok) {
              const json = (await xai.json()) as Record<string, unknown>;
              const url = pickImageUrl(json);
              if (url) return Response.json({ ok: true, kind: "image", url });
            }
          }
          const xai = await fetch("https://api.x.ai/v1/images/generations", {
            method: "POST",
            headers: authHeader(apiKey),
            body: JSON.stringify({
              model,
              prompt,
              n: 1,
              resolution: "1k",
            }),
          });
          if (xai.status === 401 || xai.status === 403 || xai.status === 429) return capacity();
          if (!xai.ok) {
            return Response.json({ error: "Imagine could not render the still." }, { status: 502 });
          }
          const json = (await xai.json()) as Record<string, unknown>;
          const url = pickImageUrl(json);
          if (!url) return Response.json({ error: "Imagine returned no still." }, { status: 502 });
          return Response.json({ ok: true, kind: "image", url });
        }

        if (body.kind === "video") {
          const klingRequested = KLING_MODELS.has(body.model ?? "");
          if (klingRequested && klingConfigured()) {
            const kling = await startKlingJob({
              prompt,
              model: body.model ?? "kling-v3-pro",
              duration: body.duration,
              aspect: body.aspect,
              image: image?.url ?? references[0]?.url,
            });
            if (kling.ok) return Response.json({ ok: true, kind: "video", requestId: kling.requestId });
          }

          if (!apiKey) {
            return Response.json(
              {
                error: wantsKling
                  ? "Kling is not connected on this host."
                  : "Imagine is not available in this environment.",
              },
              { status: 503 },
            );
          }

          const model =
            klingRequested || body.model === "grok-imagine-video-1.5" || !VIDEO_MODELS.has(body.model ?? "")
              ? "grok-imagine-video-1.5"
              : body.model!;
          const duration = body.duration === 10 ? 10 : 6;
          const aspect = body.aspect === "9:16" || body.aspect === "1:1" ? body.aspect : "16:9";
          const resolution = model === "grok-imagine-video-1.5" || klingRequested ? "720p" : "480p";
          const payload: Record<string, unknown> = {
            model,
            prompt,
            duration,
            aspect_ratio: aspect,
            resolution,
          };
          if (image) payload.image = image;
          if (references.length) payload.reference_images = references;
          const xai = await fetch("https://api.x.ai/v1/videos/generations", {
            method: "POST",
            headers: authHeader(apiKey),
            body: JSON.stringify(payload),
          });
          if (xai.status === 401 || xai.status === 403 || xai.status === 429) return capacity();
          if (!xai.ok) {
            return Response.json({ error: "Imagine could not start the clip." }, { status: 502 });
          }
          const json = (await xai.json()) as { request_id?: string; requestId?: string };
          const requestId = json.request_id || json.requestId;
          if (!requestId) return Response.json({ error: "Imagine returned no job." }, { status: 502 });
          return Response.json({ ok: true, kind: "video", requestId });
        }

        return Response.json({ error: "Unknown render kind" }, { status: 400 });
      },
      GET: async ({ request }) => {
        const requestId = new URL(request.url).searchParams.get("requestId")?.trim();
        if (!requestId || !/^[a-zA-Z0-9._|:/-]+$/.test(requestId)) {
          return Response.json({ error: "Missing render id" }, { status: 400 });
        }
        if (requestId.startsWith("k|")) {
          const kling = await pollKlingJob(requestId);
          if (!kling.ok) return Response.json({ error: kling.error }, { status: 502 });
          return Response.json(kling);
        }
        const apiKey = process.env.XAI_API_KEY;
        if (!apiKey) {
          return Response.json({ error: "Imagine is not available in this environment." }, { status: 503 });
        }
        const xai = await fetch(`https://api.x.ai/v1/videos/${encodeURIComponent(requestId)}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (xai.status === 401 || xai.status === 403 || xai.status === 429) return capacity();
        if (!xai.ok) {
          return Response.json({ error: "Could not read render status." }, { status: 502 });
        }
        const json = (await xai.json()) as Record<string, unknown>;
        const status = String(json.status ?? "pending").toLowerCase();
        if (status === "done" || status === "completed" || status === "succeeded") {
          const url = pickVideoUrl(json);
          if (!url) return Response.json({ error: "Clip finished with no file." }, { status: 502 });
          return Response.json({ ok: true, status: "done", url });
        }
        if (status === "failed" || status === "expired" || status === "error") {
          return Response.json({ error: "The clip did not finish. Run again." }, { status: 502 });
        }
        return Response.json({ ok: true, status: "pending" });
      },
    },
  },
});
