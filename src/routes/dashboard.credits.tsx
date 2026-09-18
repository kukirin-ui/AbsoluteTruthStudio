import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/studio/site-shell";
import { BuyCreditsButton } from "@/components/BuyCreditsModal";
import { Button } from "@/components/ui/button";

type Search = { success?: string; cancelled?: string };

export const Route = createFileRoute("/dashboard/credits")({
  validateSearch: (raw: Record<string, unknown>): Search => ({
    success: typeof raw.success === "string" ? raw.success : undefined,
    cancelled: typeof raw.cancelled === "string" ? raw.cancelled : undefined,
  }),
  component: CreditsPage,
  head: () => ({ meta: [{ title: "Credits · Absolute Truth Studio" }] }),
});

function CreditsPage() {
  const { success, cancelled } = Route.useSearch();
  const paid = success === "true" || success === "1";
  const aborted = cancelled === "true" || cancelled === "1";

  return (
    <SiteShell title="Studio credits" kicker="Top up · 1000 credits = €1">
      {paid ? (
        <p className="rounded-xl bg-elevated p-4 text-sm text-fg shadow-[0_0_0_1px_rgb(16_185_129/0.35)]">
          Payment received. Credits land on your wallet as soon as Stripe
          confirms the checkout — usually a few seconds. Open the studio to see
          the updated balance.
        </p>
      ) : null}
      {aborted ? (
        <p className="rounded-xl bg-elevated p-4 text-sm text-fg shadow-[0_0_0_1px_rgb(245_158_11/0.35)]">
          Checkout cancelled. No charge was made. You can try again whenever
          you&apos;re ready.
        </p>
      ) : null}
      <p>
        Buy studio credits to power the four-seat mesh. Each top-up is priced on
        its own: €10–29 at 3.5×, €30–99 at 3.0×, and €100+ at 2.5×. Larger
        amounts unlock the better rate.
      </p>
      <div className="flex flex-wrap gap-2">
        <BuyCreditsButton />
        <Button asChild variant="outline">
          <Link to="/">Back to studio</Link>
        </Button>
      </div>
    </SiteShell>
  );
}
