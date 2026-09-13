import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/studio/site-shell";
import { PLANS, STRIPE_LINKS } from "@/lib/billing";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
  head: () => ({ meta: [{ title: "Pricing · Absolute Truth Studio" }] }),
});

function PricingPage() {
  return (
    <SiteShell title="Pricing" kicker="Free · Pro $19 · Premium $49">
      <p>
        Read this first: the subscription is <span className="text-fg">not free model usage</span>. What you buy is
        the platform — a mesh that runs whatever combination you can imagine with no cap on what you build. The plan
        only sets how high a <span className="text-fg">tier</span> your agents may reach: Free is a basic tier on us,
        Pro a few tiers below the top, Premium the highest tier known today (kept current). On every plan you choose
        how many agents run (1 to 4) and can downgrade any seat by exact model name.
      </p>
      <p>
        You fund the actual model calls two ways, on any plan: buy <span className="text-fg">studio credits</span>
        {" "}(billed at 1.3× real usage — a small margin, never a meter trap), or <span className="text-fg">BYOK</span>
        {" "}— connect your own keys and run <span className="text-fg">any</span> model at cost, including ones beyond
        the main four. Combine models and all 25+ plugins however you want. Stripe-only for the subscription; tap
        Activate after checkout.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {PLANS.map((p) => (
          <article
            key={p.id}
            className="flex flex-col rounded-xl bg-panel p-4 shadow-[0_0_0_1px_rgb(255_255_255/0.06)]"
          >
            <h2 className="font-display text-lg text-fg">{p.name}</h2>
            <p className="mt-1 font-display text-2xl text-fg">
              {p.price}
              {p.id === "free" ? "" : <span className="text-sm text-muted">/mo</span>}
            </p>
            <p className="mt-2 text-xs text-muted">{p.tagline}</p>
            <p className="mt-3 text-sm leading-relaxed text-fg">{p.why}</p>
            <ul className="mt-3 space-y-1">
              {p.features.map((f) => (
                <li key={f} className="text-xs text-fg">
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-col gap-2">
              {p.id === "free" ? (
                <Button asChild variant="outline">
                  <Link to="/">Start on Free</Link>
                </Button>
              ) : (
                <Button asChild>
                  <a href={STRIPE_LINKS[p.id]} target="_blank" rel="noreferrer">
                    Pay {p.name} with Stripe
                  </a>
                </Button>
              )}
            </div>
          </article>
        ))}
      </div>
      <Button asChild variant="outline">
        <Link to="/">Activate a plan in the studio</Link>
      </Button>
    </SiteShell>
  );
}
