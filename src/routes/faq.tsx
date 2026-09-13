import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/studio/site-shell";

export const Route = createFileRoute("/faq")({
  component: FaqPage,
  head: () => ({ meta: [{ title: "FAQ · Absolute Truth Studio" }] }),
});

const FAQS = [
  {
    q: "What is Absolute Truth Studio?",
    a: "An elite workbench where four frontier agents — Claude, ChatGPT, Gemini, and Grok — work one brief in lockstep and hand you a verified answer or a real, running React app. It is built for people who already use Claude Code plus plugins and want the highest possible output from one place.",
  },
  {
    q: "If I ask for an app, do I get a real app?",
    a: "Yes. The Coder seat ships a React application — screens, frontend, and a working mock backend — into the live preview. Not an HTML poster. Export ZIP, Sync, or push to GitHub for the source.",
  },
  {
    q: "How do I pay for the model calls?",
    a: "Two ways, on any plan. Buy studio credits and we bill real usage at a 1.3× rate — a small margin, never a meter trap. Or bring your own keys (BYOK): connect your Anthropic / OpenAI / Google / xAI keys and run on your own accounts at cost, with no markup.",
  },
  {
    q: "Can I run fewer than four agents, or pick the model level?",
    a: "Yes. Choose how many of the four seats run (1 to 4) and who sits each one. Each seat has a tier selector — Free runs a basic tier, Pro a few tiers up with per-seat control, and Premium the highest tier known today. An output-power control (low / mid / max) sets how hard the seats push.",
  },
  {
    q: "What is agent memory?",
    a: "Open Memory in the header. Each seat can hold a standing prompt up to 4,000 characters. It is stored only on this device and applied every turn.",
  },
  {
    q: "Do the agents introduce themselves every turn?",
    a: "No. The four seat cards show who is working. The answer is just the product or the facts.",
  },
  {
    q: "Does the Verifier block my answer if it sees a hallucination?",
    a: "No. It flags the claim, tells you why, and how to continue. The product stays on screen. Tap Keep answer or Run again.",
  },
  {
    q: "Where is my data stored?",
    a: "Chats, projects, memory, and entitlements stay on this device in v1. Payments go through Stripe Payment Links; Activate marks the plan locally.",
  },
  {
    q: "How do I export?",
    a: "ZIP, Sync, and GitHub sit on one row next to Send. Download on a clip or still saves the file. Use See Code for full generated sources when available.",
  },
];

function FaqPage() {
  return (
    <SiteShell title="FAQ" kicker="Help">
      {FAQS.map((item) => (
        <section key={item.q} className="rounded-xl bg-panel px-4 py-3 shadow-[0_0_0_1px_rgb(255_255_255/0.06)]">
          <h2 className="font-display text-base text-fg">{item.q}</h2>
          <p className="mt-1">{item.a}</p>
        </section>
      ))}
    </SiteShell>
  );
}
