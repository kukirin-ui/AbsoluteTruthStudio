import { createFileRoute } from "@tanstack/react-router";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { FOUNDING_SLOTS, MONTH_MS } from "@/lib/referral";

type Store = {
  claimed: number;
  claims: { code: string; referredBy?: string; at: number }[];
  referrers: Record<string, { conversions: number; proUntil?: number }>;
};

const FILE = path.join(process.cwd(), ".data", "founding.json");

async function load(): Promise<Store> {
  try {
    const raw = await readFile(FILE, "utf8");
    const json = JSON.parse(raw) as Store;
    if (!json || typeof json.claimed !== "number") throw new Error("bad");
    return {
      claimed: json.claimed,
      claims: Array.isArray(json.claims) ? json.claims : [],
      referrers: json.referrers ?? {},
    };
  } catch {
    return { claimed: 0, claims: [], referrers: {} };
  }
}

async function save(store: Store) {
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(store), "utf8");
}

function publicStatus(store: Store, code?: string) {
  const ref = code ? store.referrers[code.toUpperCase()] : undefined;
  return {
    remaining: Math.max(0, FOUNDING_SLOTS - store.claimed),
    claimed: store.claimed,
    conversions: ref?.conversions ?? 0,
    referrerProUntil: ref?.proUntil,
  };
}

export const Route = createFileRoute("/api/referrals")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const code = new URL(request.url).searchParams.get("code") ?? undefined;
        const store = await load();
        return Response.json(publicStatus(store, code ?? undefined));
      },
      POST: async ({ request }) => {
        let body: { action?: string; code?: string; referredBy?: string };
        try {
          body = (await request.json()) as { action?: string; code?: string; referredBy?: string };
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }
        const buyer = (body.code ?? "").trim().toUpperCase();
        if (!/^[A-Z0-9]{6,12}$/.test(buyer)) {
          return Response.json({ error: "Invalid referral code" }, { status: 400 });
        }
        const referredBy = (body.referredBy ?? "").trim().toUpperCase();
        const store = await load();

        if (body.action === "founding") {
          if (!referredBy || referredBy === buyer) {
            return Response.json(
              { error: "Founding Pro is for the first 50 people who arrive through a referral link.", ...publicStatus(store, buyer) },
              { status: 400 },
            );
          }
          if (store.claimed >= FOUNDING_SLOTS) {
            return Response.json(
              { error: "The first 50 founding seats are taken. Standard pricing applies.", ...publicStatus(store, buyer) },
              { status: 409 },
            );
          }
          if (store.claims.some((c) => c.code === buyer)) {
            return Response.json({ error: "This device already claimed a founding seat.", ...publicStatus(store, buyer) }, { status: 409 });
          }
          store.claimed += 1;
          store.claims.push({ code: buyer, referredBy, at: Date.now() });
          const referrer = store.referrers[referredBy] ?? { conversions: 0 };
          referrer.conversions += 1;
          referrer.proUntil = Math.max(referrer.proUntil ?? 0, Date.now() + MONTH_MS);
          store.referrers[referredBy] = referrer;
          await save(store);
          return Response.json({ ok: true, ...publicStatus(store, referredBy) });
        }

        return Response.json({ error: "Unknown action" }, { status: 400 });
      },
    },
  },
});
