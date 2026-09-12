import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/studio/site-shell";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({ meta: [{ title: "About · Absolute Truth Studio" }] }),
});

function AboutPage() {
  return (
    <SiteShell title="About" kicker="Absolute Truth Studio">
      <p>
        Absolute Truth Studio is a real-time four-agent workbench — Architecture, Coder, Visual/UI, and
        Verifier/Security — that produces verified technical answers and shippable artifacts (code and stills)
        with modular plugins. Not chat theater. Not a free-video factory.
      </p>
      <p>
        Four specialized seat frameworks run on one mesh. They are role frameworks, not four separate vendor
        invoices. Talk to Me returns a technical answer plus one follow-up. Build Asset aims at a running React
        app or a still. Optional plugins attach when you need them — Kling video is attach-only, never forced.
      </p>
      <p>
        Free evaluates the multi-agent mesh: baseline seats, file attach, memory, and Talk to Me. Video is not a
        Free benefit. Pro and Premium deepen concurrency, sources, stills, and optional render plugins with
        credits. Billing is Stripe-only.
      </p>
    </SiteShell>
  );
}
