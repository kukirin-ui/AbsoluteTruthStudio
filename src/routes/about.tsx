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
        Absolute Truth Studio is an elite, no-bullshit workbench for making worldwide-grade content. Four frontier
        agents — Claude, ChatGPT, Gemini, and Grok — work one brief in lockstep and hand you a verified answer or a
        real, running React app. Not chat theater. Not a demo. The output is meant to ship.
      </p>
      <p>
        It is built for the people who already live in Claude Code and a stack of plugins and still want more:
        founders, engineers, and operators who need the highest possible output and refuse to babysit four
        separate tools. You choose how many of the four seats run (1 to 4), who sits each seat, and which tier of
        that model you spend — from a lean baseline up to the highest tier known today.
      </p>
      <p>
        There are exactly two ways to run it. Buy studio credits and we bill the real model usage at a 1.3×
        rate — you pay a small margin, we keep the lights on, nobody meters you into the ground. Or bring your own
        keys (BYOK): connect your Anthropic, OpenAI, Google, or xAI keys and the studio runs on your accounts at
        cost, no markup. Either way you own the result — export the code, take it off this device.
      </p>
      <p>
        Premium runs every seat at the highest tier available today, kept current as the frontier moves. Pro runs
        the same four seats a few tiers down with per-seat control. Free lets you feel the mesh at a basic tier on
        our credits. Plugins are optional and attach only when you ask — never forced into a plan. Billing is
        Stripe-only.
      </p>
    </SiteShell>
  );
}
