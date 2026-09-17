import { useEffect, useState } from "react";
import { SovereignCanvas, type CanvasState } from "./SovereignCanvas";

const IDLE_STATE: CanvasState = {
  phase: "idle",
  activeSeats: [],
  corrections: [],
  needsVisual: false,
};

const HINTS: readonly string[] = [
  "Speak plainly. Kira classifies your intent before a single seat activates.",
  "Simple questions route to the Architect alone — fast, cheap, and still verified.",
  "Complex builds wake the full Trinity: structure, code, audit — in lockstep.",
  "Ask for a still or a clip and watch Gemini's orbit ignite.",
  "The amber node is Grok. If a ribbon flashes red, a claim failed audit — and Kira already routed the fix.",
  "Memory prompts persist per seat. Set them once; they apply on every turn.",
  "Your own API key changes who pays for the call. It never changes how high the models may go.",
] as const;

export function KiraWelcomeState() {
  const [hintIndex, setHintIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(
      () => setHintIndex((i) => (i + 1) % HINTS.length),
      6000,
    );
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="relative flex h-full min-h-[440px] w-full flex-col overflow-hidden">
      {/* Throne room — transparent, living inside the studio's ambient field */}
      <div className="pointer-events-none absolute inset-0">
        <SovereignCanvas state={IDLE_STATE} />
      </div>

      {/* Glass status strip */}
      <div className="relative z-10 flex h-10 shrink-0 items-center justify-center border-b border-white/[0.06] bg-white/[0.03] backdrop-blur-md">
        <span className="kira-glow-text font-mono text-[11px] uppercase tracking-[0.35em] text-purple-300">
          Status · Sovereign Mesh Online
        </span>
      </div>

      {/* Headline */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
        <h2 className="text-2xl font-semibold text-white md:text-3xl">
          Four minds. One brief. Verified output.
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
          Kira routes your request. The Trinity executes. Grok audits.
          You receive truth — not guesses.
        </p>
      </div>

      {/* Glass hint pill */}
      <div className="relative z-10 mx-auto mb-8 w-full max-w-xl shrink-0 px-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 shadow-2xl backdrop-blur-xl">
          <p
            key={hintIndex}
            className="kira-hint-fade text-center text-xs leading-relaxed text-muted"
          >
            <span className="mr-2 font-mono uppercase tracking-widest text-purple-400">
              Tip
            </span>
            {HINTS[hintIndex]}
          </p>
        </div>
      </div>
    </div>
  );
}