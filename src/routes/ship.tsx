import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/studio/site-shell";
import { MARGIN_RULES, OWNER_COST_LINES } from "@/lib/economics";

export const Route = createFileRoute("/ship")({
  component: ShipPage,
  head: () => ({ meta: [{ title: "Ship · Absolute Truth Studio" }] }),
});

function ShipPage() {
  return (
    <SiteShell title="Ship the studio" kicker="Web · PWA · Play">
      <p>
        This studio is a web app. The live product is this origin. Install it as a PWA from the browser. A Play
        Store listing is a Trusted Web Activity wrapper around the same URL — not a separate native binary built
        here.
      </p>
      <h2 className="font-display text-lg text-fg">Your costs</h2>
      <p>
        Visitors spend your keys. That is why video is capped and extra clips are credit packs — so a heavy user
        cannot put you negative. Stripe revenue lands on the Absolute Truth Studio account after processor fees.
      </p>
      <ul className="space-y-3">
        {OWNER_COST_LINES.map((row) => (
          <li key={row.title} className="rounded-xl bg-panel px-4 py-3 shadow-[0_0_0_1px_rgb(255_255_255/0.06)]">
            <p className="text-sm text-fg">{row.title}</p>
            <p className="text-[10px] tracking-wider text-subtle uppercase">{row.who}</p>
            <p className="mt-1 text-sm text-muted">{row.note}</p>
          </li>
        ))}
      </ul>
      <h2 className="font-display text-lg text-fg">Margin rules</h2>
      <ul className="list-disc space-y-1 pl-5">
        {MARGIN_RULES.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <h2 className="font-display text-lg text-fg">Web</h2>
      <p>
        Deploy the origin. Visitors land on Free. Stripe checkout for Pro ($19/mo) and Premium ($49/mo) is live on
        the Absolute Truth Studio Stripe account. After processor fees, that money is yours. Imagine and Kling cost
        is billed on the host keys, not on Stripe.
      </p>
      <h2 className="font-display text-lg text-fg">Google Play</h2>
      <p>
        Use Bubblewrap / TWA against the production URL, sign the AAB in Play Console, and set the Digital Asset
        Links file on this domain. The app the user runs is still this studio.
      </p>
      <h2 className="font-display text-lg text-fg">Owner versus visitor</h2>
      <p>
        You unlock owner mode with the owner code (default ATS-OWNER, override with OWNER_CODE on the host). Owner
        gets every plan and plugin. Visitors cannot. They pay Stripe for Pro or Premium, or buy a plugin / credit
        pack.
      </p>
      <h2 className="font-display text-lg text-fg">Host keys — what to add</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          XAI_API_KEY — already injected in this preview. Powers the mesh, stills, and Imagine video. This is the
          app-owner quota. Do not put it in the browser.
        </li>
        <li>
          OWNER_CODE — change it before public launch so visitors cannot type the default.
        </li>
        <li>
          KLING_ACCESS_KEY + KLING_SECRET_KEY, or FAL_KEY — only if you want real Kling instead of Imagine 1.5
          fallback. Without these, seating Kling still ships a clip on Imagine and says so.
        </li>
        <li>Stripe Payment Links are already live. No extra Stripe secret is required for those links.</li>
      </ul>
    </SiteShell>
  );
}
