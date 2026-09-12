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
    <SiteShell title="The four seats" kicker="Distinct frameworks · lockstep mesh">
      <p>
        Four seats pass the brief between them — Architecture, Coder, Visual/UI, and Verifier/Security. Each
        seat has its own operating framework (not a mirrored persona). Click a seat in the studio, tap Change,
        and pick any agent from the catalog. Attach tools to that seat. Defaults stay Claude, Imagine, ChatGPT,
        and Grok until you swap them. {CATALOG_COUNTS.total} agents and tools in total.
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
        Seat states on the dashboard: <strong className="text-fg">IDLE</strong> (empty / between runs),{" "}
        <strong className="text-fg">LIVE</strong> (that seat is streaming),{" "}
        <strong className="text-fg">RENDER PAUSED</strong> (visual/render path waiting or paused). Ask a
        technical question and the mesh returns a verified answer. Ask for a still and Visual briefs the frame.
        Ask for an app and Coder ships a React product into the live preview. Optional render plugins attach when
        needed. Verifier warns when a claim is unverified — it never auto-blocks.
      </p>
      <Button asChild>
        <Link to="/">Change a seat in the studio</Link>
      </Button>
    </SiteShell>
  );
}
