import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/studio/site-shell";
import { PLUGINS_CATALOG, PLUGIN_COUNTS, SEAT_META, wireLabel } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/plugins")({
  component: PluginsPage,
  head: () => ({ meta: [{ title: "Plugins · Absolute Truth Studio" }] }),
});

function PluginsPage() {
  const free = PLUGINS_CATALOG.filter((c) => c.tier === "free");
  const paid = PLUGINS_CATALOG.filter((c) => c.tier === "paid").sort((a, b) => a.cents - b.cents);
  return (
    <SiteShell title="Plugins" kicker={`${PLUGIN_COUNTS.total} in the catalog`}>
      <p>
        {PLUGIN_COUNTS.free} free and {PLUGIN_COUNTS.paid} paid. Plugins attach to whichever agent is already
        seated — they never replace it. Looking for a different model in a seat instead of a plugin? That's on the{" "}
        <Link to="/agents">Agents</Link> page.
      </p>
      <p className="text-sm text-muted">
        Each seat runs a real frontier model — Claude, ChatGPT, Gemini, or Grok — routed to that provider on your
        credits or your own key (BYOK). Agent-native plugins are tuned to what each model does best; attach the ones
        you need. Your plan still sets the model-tier ceiling; BYOK does not raise it.
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

function CatalogList({ items }: { items: typeof PLUGINS_CATALOG }) {
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
