import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/studio/site-shell";

export const Route = createFileRoute("/ship")({
  component: ShipPage,
  head: () => ({ meta: [{ title: "Ship · Absolute Truth Studio" }] }),
});

const KEYS = [
  {
    key: "ANTHROPIC_API_KEY · OPENAI_API_KEY · GEMINI_API_KEY · XAI_API_KEY",
    note: "The four provider keys behind the mesh. Each seat routes to its own provider on your credits. Server-only — never expose them to the browser.",
  },
  {
    key: "MESH_MODEL_ANTHROPIC · MESH_MODEL_OPENAI · MESH_MODEL_GOOGLE · MESH_MODEL_XAI",
    note: "Optional. Pin the exact model per provider — the update-any-day lever as new frontier models ship. Omit and the studio uses today's flagship by default.",
  },
  {
    key: "OWNER_CODE",
    note: "Unlocks owner mode. Set your own before launch so only you see every tier and plugin.",
  },
];

function ShipPage() {
  return (
    <SiteShell title="Ship the studio" kicker="Web · PWA · Play">
      <p>
        Absolute Truth Studio is a web application. The live product is this origin — deploy it and share the URL.
        Visitors can install it as a PWA from the browser, and a Play Store listing is a Trusted Web Activity
        wrapper around the same address, not a separate binary.
      </p>
      <h2 className="font-display text-lg text-fg">How runs are powered</h2>
      <p>
        Every seat calls a real frontier model. A run is powered one of two ways: the visitor spends studio credits
        (billed through Stripe), or they connect their own provider key (BYOK) and run on their own account. Credits
        keep it one-click; BYOK runs at the visitor's own cost.
      </p>
      <h2 className="font-display text-lg text-fg">Owner vs. visitor</h2>
      <p>
        Owner mode unlocks every plan tier and plugin for you. Visitors start on the basic tier and unlock Pro or
        Premium through Stripe, or bring their own keys. What each side sees is separated automatically — you get
        the full studio, visitors get exactly what their plan allows.
      </p>
      <h2 className="font-display text-lg text-fg">Environment keys</h2>
      <ul className="space-y-3">
        {KEYS.map((row) => (
          <li key={row.key} className="rounded-xl bg-panel px-4 py-3 shadow-[0_0_0_1px_rgb(255_255_255/0.06)]">
            <p className="font-mono text-[11px] leading-relaxed break-words text-fg">{row.key}</p>
            <p className="mt-1 text-sm text-muted">{row.note}</p>
          </li>
        ))}
      </ul>
      <h2 className="font-display text-lg text-fg">Google Play</h2>
      <p>
        Wrap the production URL with Bubblewrap / TWA, sign the AAB in Play Console, and add the Digital Asset Links
        file to this domain. The app the user runs is still this studio.
      </p>
    </SiteShell>
  );
}
