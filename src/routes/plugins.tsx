import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/studio/site-shell";
import { CATALOG, CATALOG_COUNTS, SEAT_META, wireLabel } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/plugins")({
  component: PluginsPage,
  head: () => ({ meta: [{ title: "Plugins · Absolute Truth Studio" }] }),
});

function PluginsPage() {
  const free = CATALOG.filter((c) => c.tier === "free");
  const paid = CATALOG.filter((c) => c.tier === "paid").sort((a, b) => a.cents - b.cents);
  return (
    <SiteShell title="Agents and tools" kicker={`${CATALOG_COUNTS.total} in the catalog`}>
      <p>
        {CATALOG_COUNTS.free} free and {CATALOG_COUNTS.paid} paid. Click any of the four seats in the studio, tap
        Change, and swap who sits there. Attach tools to the seats they support. The four live seats always pass
        the brief between them — that is the product.
      </p>
      <p className="text-sm text-muted">
        Defaults stay Claude, Imagine, ChatGPT, and Grok until you change them. Real render hosts are Imagine
        (XAI_API_KEY) and Kling (only if Kling/Fal keys exist). Look packs (Veo, Runway, Flux, Ideogram, …) change
        the brief and still render on those hosts — they are not separate vendor APIs. Mesh seats (Claude, ChatGPT,
        Llama, Gemini) are role prompts on Grok 4.5. The four live seats always pass the brief.
      </p>
      <h2 className="font-display text-lg text-fg">Free — {free.length}</h2>
      <CatalogList items={free} />
      <h2 className="font-display text-lg text-fg">Paid — {paid.length}</h2>
      <CatalogList items={paid} />
      <Button asChild>
        <Link to="/">Open the studio and change a seat</Link>
      </Button>
    </SiteShell>
  );
}

function CatalogList({ items }: { items: typeof CATALOG }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id} className="rounded-xl bg-panel px-4 py-3 shadow-[0_0_0_1px_rgb(255_255_255/0.06)]">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-display text-lg text-fg">{item.name}</p>
            {item.tier === "paid" ? <Badge variant="indigo">{item.price}</Badge> : <Badge variant="muted">Free</Badge>}
          </div>
          <p className="text-[10px] tracking-wider text-subtle uppercase">
            {item.brand} · {item.kind} · {item.seats.map((s) => SEAT_META[s].label).join(" / ")}
          </p>
          <p className="mt-1 text-sm">{item.blurb}</p>
          <p className="mt-1 text-xs text-muted">{item.why}</p>
          <p className="mt-1 text-[10px] text-subtle">{wireLabel(item.wire, item.id)}</p>
        </li>
      ))}
    </ul>
  );
}
