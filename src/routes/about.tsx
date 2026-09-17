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
        Absolute Truth Studio is a precision workbench for people who ship at the highest level. Four frontier
        agents — Claude, ChatGPT, Gemini, and Grok — take one brief together, challenge each other's work, and hand
        you a verified answer or a real, running React application. Every claim is checked. Every deliverable is
        meant to ship.
      </p>
      <p>
        Why this over Claude Code and a drawer of plugins? Because a single model cannot audit itself. Here, four
        of the best models on earth reach consensus on the same brief in one place — you get the cross-checked
        answer and the finished product from one seat, instead of stitching tools together and hoping.
      </p>
      <p>
        You stay in control. Choose how many of the four seats run (1 to 4), who sits each one, and how high a tier
        of that model you use — from a fast baseline up to the highest tier available today, with a per-seat
        downgrade by exact model name. Combine any in-ceiling models with any plugin your plan includes.
      </p>
      <p>
        Run it two ways. Buy <strong className="font-medium text-fg">studio credits</strong> for one-click access, or
        use <strong className="font-medium text-fg">BYOK</strong> and connect your own Anthropic, OpenAI, Google, or
        xAI key to run on your own accounts. A personal key does not raise the plan ceiling. Premium unlocks the
        highest tier of every agent, kept current as the frontier moves; Pro sits a few tiers below so you can feel
        the ceiling; the basic tier lets you try the mesh first. Billing is Stripe-only.
      </p>
    </SiteShell>
  );
}
