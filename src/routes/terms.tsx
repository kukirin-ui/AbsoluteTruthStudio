import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/studio/site-shell";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({ meta: [{ title: "Terms · Absolute Truth Studio" }] }),
});

function TermsPage() {
  return (
    <SiteShell title="Terms" kicker="Use of the studio">
      <p>
        Absolute Truth Studio is provided as a professional tool for building and verifying your work. You own what
        you create, and you are responsible for how you use the answers and assets it produces.
      </p>
      <p>
        Subscriptions and credits are billed through Stripe. Plan and credit purchases activate on this device after
        checkout. When you connect your own provider keys (BYOK), those calls run on your own accounts under your
        providers' terms.
      </p>
      <p>
        Current pricing for Pro and Premium is published on the Pricing page. We do not add hidden fees, alternate
        payment rails, or crypto checkout.
      </p>
    </SiteShell>
  );
}
