/**
 * Client helpers for /api/byok.
 * Metadata only — never log, store, or echo secrets after submit.
 */

export type ByokProvider =
  | "openai"
  | "anthropic"
  | "xai"
  | "google"
  | "mistral"
  | "deepseek"
  | "qwen"
  | "meta";

export const BYOK_PROVIDERS: readonly ByokProvider[] = [
  "openai",
  "anthropic",
  "xai",
  "google",
  "mistral",
  "deepseek",
  "qwen",
  "meta",
] as const;

export const BYOK_PROVIDER_LABELS: Record<ByokProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  xai: "xAI",
  google: "Google",
  mistral: "Mistral",
  deepseek: "DeepSeek",
  qwen: "Qwen (Alibaba / DashScope)",
  meta: "Muse Spark (Meta — successor to Llama)",
};

/** List/POST success metadata — never includes ciphertext or plaintext. */
export type ByokCredentialMeta = {
  provider: ByokProvider;
  label: string | null;
  keyVersion: string;
  updatedAt: string;
  lastUsedAt?: string | null;
  createdAt?: string;
};

export type ByokApiError = {
  error: string;
  code: string;
  details?: unknown;
  status: number;
};

function parseError(status: number, body: unknown): ByokApiError {
  const b = body as { error?: string; code?: string; details?: unknown } | null;
  return {
    error: typeof b?.error === "string" ? b.error : `BYOK error ${status}`,
    code: typeof b?.code === "string" ? b.code : "UNKNOWN",
    details: b?.details ?? null,
    status,
  };
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function listByokCredentials(): Promise<
  | { ok: true; credentials: ByokCredentialMeta[] }
  | { ok: false; error: ByokApiError }
> {
  try {
    const res = await fetch("/api/byok", { method: "GET", credentials: "include" });
    const body = await readJson(res);
    if (!res.ok) {
      return { ok: false, error: parseError(res.status, body) };
    }
    const credentials = Array.isArray((body as { credentials?: unknown })?.credentials)
      ? ((body as { credentials: ByokCredentialMeta[] }).credentials)
      : [];
    return { ok: true, credentials };
  } catch {
    return {
      ok: false,
      error: { error: "Network error", code: "NETWORK", status: 0 },
    };
  }
}

export async function upsertByokCredential(input: {
  provider: ByokProvider;
  secret: string;
  label?: string | null;
}): Promise<
  | { ok: true; meta: ByokCredentialMeta }
  | { ok: false; error: ByokApiError }
> {
  // Do not log input.secret — paste once, clear in UI on success.
  try {
    const res = await fetch("/api/byok", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: input.provider,
        secret: input.secret,
        label: input.label ?? undefined,
      }),
    });
    const body = await readJson(res);
    if (!res.ok) {
      return { ok: false, error: parseError(res.status, body) };
    }
    const meta = body as ByokCredentialMeta;
    return { ok: true, meta };
  } catch {
    return {
      ok: false,
      error: { error: "Network error", code: "NETWORK", status: 0 },
    };
  }
}

export async function deleteByokCredential(
  provider: ByokProvider,
): Promise<
  | { ok: true; deleted: boolean; provider: ByokProvider }
  | { ok: false; error: ByokApiError }
> {
  try {
    const res = await fetch(`/api/byok?provider=${encodeURIComponent(provider)}`, {
      method: "DELETE",
      credentials: "include",
    });
    const body = await readJson(res);
    if (!res.ok) {
      return { ok: false, error: parseError(res.status, body) };
    }
    const deleted = Boolean((body as { deleted?: boolean })?.deleted);
    return { ok: true, deleted, provider };
  } catch {
    return {
      ok: false,
      error: { error: "Network error", code: "NETWORK", status: 0 },
    };
  }
}

/** User-facing copy for 401 / BYOK_NOT_CONFIGURED / AUTH_MISCONFIGURED — no secrets. */
export function byokErrorMessage(err: ByokApiError): string {
  if (err.status === 401 || err.code === "UNAUTHORIZED") {
    return "Sign in required to manage API keys.";
  }
  if (err.code === "BYOK_NOT_CONFIGURED" || err.status === 503) {
    return "Key vault is not configured on this server yet.";
  }
  if (err.code === "AUTH_MISCONFIGURED") {
    return "Auth is not available in this environment.";
  }
  return err.error || "Could not update keys.";
}
