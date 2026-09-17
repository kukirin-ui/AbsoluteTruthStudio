export type ImagineStartInput = {
  kind: "image" | "video";
  prompt: string;
  model: string;
  duration?: number;
  aspect?: string;
  image?: string;
  references?: string[];
  signal?: AbortSignal;
};

export type ImagineOkImage = { ok: true; kind: "image"; url: string };
export type ImagineOkVideo = { ok: true; kind: "video"; requestId: string };
export type ImagineFail = { ok: false; error: string };
export type ImagineStartResult = ImagineOkImage | ImagineOkVideo | ImagineFail;

export type ImaginePollOk =
  | { ok: true; status: "done"; url?: string }
  | { ok: true; status: "pending" };
export type ImaginePollResult = ImaginePollOk | ImagineFail;

export async function startImagine(input: ImagineStartInput): Promise<ImagineStartResult> {
  const res = await fetch("/api/imagine", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "generate",
      kind: input.kind,
      prompt: input.prompt,
      model: input.model,
      duration: input.duration,
      aspect: input.aspect,
      image: input.image,
      references: input.references?.slice(0, 7),
    }),
    signal: input.signal,
  });
  try {
    const body = (await res.json()) as ImagineStartResult & { error?: string };
    if (!res.ok) {
      return {
        ok: false,
        error: body && "error" in body && body.error ? body.error : "Render failed",
      };
    }
    return body;
  } catch {
    return {
      ok: false,
      error: "Render failed",
    };
  }
}

async function pollImagine(requestId: string, signal?: AbortSignal): Promise<ImaginePollResult> {
  const res = await fetch(`/api/imagine?requestId=${encodeURIComponent(requestId)}`, { signal });
  try {
    const body = (await res.json()) as ImaginePollResult & { error?: string };
    if (!res.ok) {
      return {
        ok: false,
        error: body && "error" in body && body.error ? body.error : "Render failed",
      };
    }
    return body;
  } catch {
    return {
      ok: false,
      error: "Render failed",
    };
  }
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("Stopped", "AbortError"));
      },
      { once: true },
    );
  });
}

export async function waitForVideo(
  requestId: string,
  signal?: AbortSignal,
  onTick?: (i: number) => void,
): Promise<ImaginePollResult | ImagineFail> {
  const kling = requestId.startsWith("k|");
  const ticks = kling ? 72 : 40;
  const delay = kling ? 5_000 : 4_000;
  for (let i = 0; i < ticks; i++) {
    if (signal?.aborted) {
      return {
        ok: false,
        error: "Stopped",
      };
    }
    const status = await pollImagine(requestId, signal);
    onTick?.(i);
    if (!status.ok) return status;
    if (status.status === "done") return status;
    await sleep(delay, signal);
  }
  return {
    ok: false,
    error: "The clip is still rendering. Run again in a moment.",
  };
}
