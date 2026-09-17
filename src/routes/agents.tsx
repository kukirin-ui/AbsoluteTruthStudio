import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/studio/site-shell";
import { CATALOG_COUNTS, SEAT_META, SEAT_ORDER, agentsForSeat } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/agents")({
  component: AgentsPage,
  head: () => ({ meta: [{ title: "Agents · Absolute Truth Studio" }] }),
});

function AgentsPage() {
  return (
    <SiteShell title="The four seats" kicker="Four minds · one brief · in lockstep">
      <p>
        Four specialized seats carry one brief between them — Architecture, Visual/UI, Coder, and
        Verifier/Security — and challenge each other's work until it holds up. Open any seat in the studio, choose
        who sits there from the catalog, set its model tier, and attach the tools it supports. The four defaults are
        Claude, Gemini, ChatGPT, and Grok until you swap them. {CATALOG_COUNTS.total} agents and tools to combine.
      </p>
      <ul className="space-y-3">
        {SEAT_ORDER.map((seat) => {
          const meta = SEAT_META[seat];
          const agents = agentsForSeat(seat);
          return (
            <li
              key={seat}
              className="relative overflow-hidden rounded-xl bg-panel px-4 py-3 shadow-[0_0_0_1px_rgb(255_255_255/0.06)]"
            >
              <div className={cn("absolute inset-y-3 left-0 w-0.5 rounded-full", meta.accent)} />
              <div className="pl-3">
                <p className="text-xs tracking-wider text-subtle uppercase">{meta.label}</p>
                <p className="font-display text-lg text-fg">{meta.role}</p>
                <p className="mt-1 font-mono text-[11px] leading-relaxed text-muted">{meta.framework}</p>
                <p className="mt-2 text-xs text-muted">
                  Can sit here: {agents.map((a) => a.name).join(" · ")}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      <p>
        Seat states on the dashboard: <strong className="text-fg">IDLE</strong> (between runs),{" "}
        <strong className="text-fg">LIVE</strong> (that seat is working). Ask a technical question and the mesh
        returns a cross-checked answer with sources. Ask for an app and Coder ships a real React product into the
        live preview. Turn seats on or off to run 1 to 4 agents, and set each one's tier. The Verifier flags any
        claim it can't stand behind — it warns, it never hides the answer.
      </p>
      <Button asChild>
        <Link to="/">Change a seat in the studio</Link>
      </Button>
    </SiteShell>
  );
}
