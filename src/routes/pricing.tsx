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
        Your plan sets one thing: how high a <span className="text-fg">tier</span> your agents may reach. The basic
        tier lets you try the mesh, Pro sits a few tiers below the top, and Premium runs the highest tier available
        today — kept current as the frontier moves. On every plan you choose how many agents run (1 to 4) and can
        downgrade any seat by its exact model name.
      </p>
      <p>
        Run the models two ways, on any plan: buy <span className="text-fg">studio credits</span> for one-click
        access, or use <span className="text-fg">BYOK</span> — connect your own keys and run on your own accounts.
        A personal key does not raise the plan ceiling; it only changes who pays. Combine any in-ceiling models with
        any plugin your plan includes. Stripe-only for the subscription; tap Activate after checkout.
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
