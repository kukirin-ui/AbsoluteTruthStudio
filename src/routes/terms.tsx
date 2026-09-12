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
        The studio is provided as-is for building and verifying work on your device. You are responsible for how you
        use generated answers and assets.
      </p>
      <p>
        Billing is Stripe-only. Plugin and plan upgrades grant local entitlements on this device after checkout and
        Activate. There is no crypto or web3 checkout path.
      </p>
      <p>
        List pricing for Pro and Premium is published on the Pricing page. Referral and founding promotions, when
        offered, never replace Stripe list checkout and do not introduce alternate payment rails.
      </p>
    </SiteShell>
  );
}
