import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/studio/site-shell";

export const Route = createFileRoute("/faq")({
  component: FaqPage,
  head: () => ({ meta: [{ title: "FAQ · Absolute Truth Studio" }] }),
});

const FAQS = [
  {
    q: "If I ask for an app, do I get a real app?",
    a: "Yes. The Coder seat ships a React application — screens, frontend, and a working mock backend — into the live preview. Not an HTML poster. Export ZIP if you want the source.",
  },
  {
    q: "Is video included on Free?",
    a: "No. Free is multi-agent eval only (Talk to Me, attach, memory, baseline seats). Video and other render plugins are Pro+ optional paths with credits — never the product headline.",
  },
  {
    q: "What is agent memory?",
    a: "Open Memory in the header. Each seat can hold a standing prompt up to 4,000 characters. It is stored only on this device and applied every turn.",
  },
  {
    q: "How do referrals work?",
    a: "Share your /r/ link. Referral rewards apply after a referred buyer activates a paid Pro or Premium plan via Stripe. List prices stay $19/mo Pro and $49/mo Premium — no crypto checkout.",
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
