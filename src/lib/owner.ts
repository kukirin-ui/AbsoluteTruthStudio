const KEY = "ats-owner-v1";

function previewIsOwnerHost() {
  if (typeof window === "undefined") return false;
  return /grok-sandbox|localhost|127\.0\.0\.1/.test(window.location.hostname);
}

export function readOwner() {
  if (typeof window === "undefined") return false;
  try {
    if (localStorage.getItem(KEY) === "1") return true;
  } catch {
    /* ignore */
  }
  return previewIsOwnerHost();
}

export function writeOwner(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export async function unlockOwner(code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch("/api/owner", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  try {
    const body = (await res.json()) as { ok?: boolean; error?: string };
    if (body.ok) {
      writeOwner(true);
      return { ok: true };
    }
    return {
      ok: false,
      error: body.error || "Wrong owner code.",
    };
  } catch {
    return {
      ok: false,
      error: "Could not verify owner code.",
    };
  }
}
