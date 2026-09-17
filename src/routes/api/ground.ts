import { createFileRoute } from "@tanstack/react-router";
import { localProductLock } from "@/lib/product-lock";

type Body = { prompt?: string; kind?: string };

export const Route = createFileRoute("/api/ground")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }
        const prompt = (body.prompt ?? "").trim().slice(0, 800);
        if (!prompt) return Response.json({ error: "Prompt required" }, { status: 400 });
        const local = localProductLock(prompt);
        const apiKey = process.env.XAI_API_KEY;
        if (!apiKey) {
          return Response.json({ ok: true, ...local, source: "local" });
        }
        try {
          const xai = await fetch("https://api.x.ai/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "grok-4.5",
              temperature: 0,
              max_tokens: 500,
              response_format: { type: "json_object" },
              messages: [
                {
                  role: "system",
                  content: `Extract the EXACT named product for a photoreal render. Never substitute a similar brand. If a reference photo is implied, say so. If unknown, say unknown — do not invent a stand-in.
Return JSON: {"subject":"make + model + type","visual":"distinctive visual facts only","negatives":"what it is NOT","shots":["shot 1","shot 2"]}`,
                },
                { role: "user", content: prompt },
              ],
            }),
          });
          if (!xai.ok) return Response.json({ ok: true, ...local, source: "local" });
          const json = (await xai.json()) as { choices?: { message?: { content?: string } }[] };
          const raw = json.choices?.[0]?.message?.content ?? "";
          const parsed = JSON.parse(raw) as {
            subject?: string;
            visual?: string;
            negatives?: string;
            shots?: string[];
          };
          if (!parsed.subject || !parsed.visual) return Response.json({ ok: true, ...local, source: "local" });
          return Response.json({
            ok: true,
            source: "mesh",
            subject: String(parsed.subject).slice(0, 180),
            visual: String(parsed.visual).slice(0, 700),
            negatives: String(parsed.negatives || local.negatives).slice(0, 400),
            shots: Array.isArray(parsed.shots) ? parsed.shots.map((s) => String(s).slice(0, 400)).slice(0, 6) : local.shots,
          });
        } catch {
          return Response.json({ ok: true, ...local, source: "local" });
        }
      },
    },
  },
});
