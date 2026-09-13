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
        One thing decides the plan: how high a tier the four seats — Claude, ChatGPT, Gemini, Grok — get to run.
        Free is a basic tier on us. Pro steps up a few tiers with per-seat control. Premium runs the highest tier
        known today, kept current. On every plan you choose how many of the four agents run and which level each
        one spends.
      </p>
      <p>
        Two ways to pay for the model calls, on any plan: buy <span className="text-fg">studio credits</span>
        {" "}(billed at a 1.3× rate on real usage — a small margin, never a meter trap), or use{" "}
        <span className="text-fg">BYOK</span> and connect your own Anthropic / OpenAI / Google / xAI keys to run at
        cost with no markup. Stripe-only for the subscription. After checkout, tap Activate on this device.
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
