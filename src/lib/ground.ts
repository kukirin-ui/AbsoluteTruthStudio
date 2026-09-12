import { applyLock, localProductLock, type ProductLock } from "@/lib/product-lock";

export async function groundPrompt(prompt: string, kind?: string): Promise<ProductLock> {
  const fallback = localProductLock(prompt);
  if (kind !== "image" && kind !== "video") return fallback;
  try {
    const res = await fetch("/api/ground", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        kind,
      }),
    });
    if (!res.ok) return fallback;
    const body = (await res.json()) as {
      ok?: boolean;
      subject?: string;
      visual?: string;
      negatives?: string;
      shots?: string[];
    };
    if (!body.ok || !body.subject || !body.visual) return fallback;
    const lock: ProductLock = {
      subject: body.subject,
      visual: body.visual,
      negatives: body.negatives || fallback.negatives,
      shots: Array.isArray(body.shots) && body.shots.length ? body.shots : fallback.shots,
      full: `LOCKED SUBJECT: ${body.subject}. ${body.visual} ${body.negatives || fallback.negatives}`
        .replace(/\s+/g, " ")
        .slice(0, 900),
    };
    return {
      ...lock,
      full: applyLock(prompt, lock),
    };
  } catch {
    return fallback;
  }
}
