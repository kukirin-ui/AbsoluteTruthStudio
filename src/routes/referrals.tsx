import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/studio/site-shell";
import { Button } from "@/components/ui/button";
import { useStudio } from "@/lib/store";
import { fetchFounding } from "@/lib/referral";
import { toast } from "sonner";

export const Route = createFileRoute("/referrals")({
  component: ReferralsPage,
  head: () => ({ meta: [{ title: "Referrals · Absolute Truth Studio" }] }),
});

function ReferralsPage() {
  const store = useStudio();
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState("");
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = code ? `${origin}/r/${code}` : "";

  useEffect(() => {
    const c = store.ensureReferralCode();
    setCode(c);
    void fetchFounding(c).then((s) => {
      store.setConversions(s.conversions);
      if (s.referrerProUntil && s.referrerProUntil > Date.now()) {
        store.applyReferrerMonth(s.referrerProUntil);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SiteShell title="Referrals" kicker="Share the studio">
      <p>
        Share your link. Referral rewards apply after a referred buyer activates paid Pro or Premium via Stripe.
        List prices stay $19/mo and $49/mo — no crypto checkout. Program economics refine in a later slice; this
        page keeps your link and conversion count.
      </p>
      <div className="rounded-xl bg-panel p-4 shadow-[0_0_0_1px_rgb(255_255_255/0.06)]">
        <p className="text-[10px] tracking-[0.16em] text-subtle uppercase">Your link</p>
        <p className="mt-2 break-all font-mono text-sm text-fg">{link}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => {
              void navigator.clipboard.writeText(link).then(() => {
                setCopied(true);
                toast.success("Referral link copied");
              });
            }}
          >
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        <li className="rounded-xl bg-panel px-4 py-3 shadow-[0_0_0_1px_rgb(255_255_255/0.06)]">
          <p className="text-[10px] tracking-[0.16em] text-subtle uppercase">Your conversions</p>
          <p className="mt-1 font-display text-2xl text-fg">{store.referral.conversions}</p>
        </li>
        <li className="rounded-xl bg-panel px-4 py-3 shadow-[0_0_0_1px_rgb(255_255_255/0.06)]">
          <p className="text-[10px] tracking-[0.16em] text-subtle uppercase">Code</p>
          <p className="mt-1 font-display text-2xl text-fg">{code}</p>
        </li>
      </ul>
    </SiteShell>
  );
}
