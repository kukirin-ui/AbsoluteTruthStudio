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
        Be clear on what a subscription is: it is <strong className="font-medium text-fg">not</strong> free model
        usage. It is a platform with no limits on what you combine — any models, any of the 25+ plugins, 1 to 4
        agents, in whatever arrangement your work needs. You fund the actual calls two ways. Buy studio credits and
        we bill real usage at a 1.3× rate — a small margin, never a meter trap. Or bring your own keys (BYOK):
        connect your Anthropic, OpenAI, Google, or xAI keys — and any other provider you hold — and run that exact
        model at cost, no markup, even models beyond the main four seats. Either way you own the result.
      </p>
      <p>
        The plan sets one thing: how high a tier your agents may reach. Premium runs every agent — the main four
        and the whole library — at the highest tier known today, kept current, with a per-seat downgrade by exact
        model name. Pro sits a few tiers below the top so you can see what Premium delivers, with the same downgrade
        control. Free is a basic tier on our credits. Plugins attach only when you ask. Billing is Stripe-only.
      </p>
    </SiteShell>
  );
}
