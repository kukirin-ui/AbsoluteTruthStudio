/**
 * SovereignCanvas v2 — the Throne Room, themed to the studio.
 *
 * Design contract:
 *  - Transparent background: the site's ambient field shows through.
 *  - Seat colors are read from SEAT_META glow tokens (single source of truth),
 *    so the canvas can never drift from the web design.
 *  - Glassy orbs, glowing beams, ripple crown and the emerald correction
 *    ribbon mirror the approved concept render.
 */
import { useEffect, useRef } from "react";
import { SEAT_META } from "@/lib/catalog";

export type TrinitySeat = "architect" | "coder" | "security";

export interface CorrectionThread {
  from: TrinitySeat;
  to: TrinitySeat;
  reason: string;
  status: "pending" | "applied" | "failed";
}

export interface CanvasState {
  phase: "idle" | "dispatching" | "executing" | "quality-gate" | "synthesizing";
  activeSeats: TrinitySeat[];
  corrections: CorrectionThread[];
  needsVisual?: boolean;
}

const SEATS: readonly TrinitySeat[] = ["architect", "coder", "security"] as const;
const CROWN_RGB = "168, 85, 247";

const WISPS = [
  { rgb: "64, 86, 160", dx: -0.22, dy: -0.14, r: 0.62, sp: 0.11 },
  { rgb: "38, 66, 128", dx: 0.24, dy: 0.16, r: 0.55, sp: 0.08 },
  { rgb: "104, 58, 148", dx: 0.04, dy: -0.26, r: 0.44, sp: 0.14 },
] as const;

/** Studio design token → canvas rgb triplet. */
function seatRgb(seat: TrinitySeat | "visual"): string {
  const m = SEAT_META[seat].glow.match(/rgb\((\d+)_(\d+)_(\d+)\)/);
  return m ? `${m[1]}, ${m[2]}, ${m[3]}` : "255, 255, 255";
}

function drawOrb(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number,
  rgb: string, intensity: number,
) {
  // Halo
  const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 2.8);
  halo.addColorStop(0, `rgba(${rgb}, ${0.35 * intensity})`);
  halo.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(x, y, r * 2.8, 0, Math.PI * 2); ctx.fill();

  // Glass body
  const body = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  body.addColorStop(0, "rgba(255, 255, 255, 0.9)");
  body.addColorStop(0.3, `rgba(${rgb}, 0.85)`);
  body.addColorStop(1, `rgba(${rgb}, 0.12)`);
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();

  // Rim light
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.22 + 0.18 * intensity})`;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x, y, r - 0.5, 0, Math.PI * 2); ctx.stroke();

  // Specular highlight
  const sx = x - r * 0.35;
  const sy = y - r * 0.42;
  const spec = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 0.35);
  spec.addColorStop(0, "rgba(255, 255, 255, 0.9)");
  spec.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = spec;
  ctx.beginPath(); ctx.arc(sx, sy, r * 0.35, 0, Math.PI * 2); ctx.fill();
}

function drawBeam(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  rgb: string, alpha: number,
) {
  const g = ctx.createLinearGradient(x1, y1, x2, y2);
  g.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
  g.addColorStop(1, `rgba(${rgb}, ${alpha})`);
  ctx.save();
  ctx.shadowBlur = 14;
  ctx.shadowColor = `rgba(${rgb}, 0.8)`;
  ctx.strokeStyle = g;
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.restore();
}

/** Multi-strand energy ribbon — the spectacle of an enforced standard. */
function drawRibbon(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  t: number, status: CorrectionThread["status"],
) {
  const rgb =
    status === "applied" ? "16, 185, 129" :
    status === "failed" ? "239, 68, 68" : "245, 158, 11";
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;

  ctx.save();
  ctx.shadowBlur = 12;
  ctx.shadowColor = `rgba(${rgb}, 0.9)`;
  for (let s = 0; s < 4; s++) {
    ctx.strokeStyle = `rgba(${rgb}, ${0.55 - s * 0.11})`;
    ctx.lineWidth = 2.2 - s * 0.45;
    if (s === 1) ctx.setLineDash([9, 7]); else ctx.setLineDash([]);
    ctx.lineDashOffset = -t * 40;
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const p = i / 24;
      const wave =
        Math.sin(p * Math.PI * 3 + t * 4 + s * 1.3) *
        (7 + s * 3) *
        Math.sin(p * Math.PI);
      const x = x1 + dx * p + nx * wave;
      const y = y1 + dy * p + ny * wave;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function render(
  ctx: CanvasRenderingContext2D,
  w: number, h: number, t: number,
  state: CanvasState,
) {
  // Transparent: the studio's ambient field lives underneath.
  ctx.clearRect(0, 0, w, h);

  // Nebula wisps (depth, 7% alpha — never a slab)
  for (const wsp of WISPS) {
    const cxw = w / 2 + wsp.dx * w + Math.cos(t * wsp.sp) * w * 0.05;
    const cyw = h / 2 + wsp.dy * h + Math.sin(t * wsp.sp * 1.3) * h * 0.05;
    const r = Math.min(w, h) * wsp.r;
    const g = ctx.createRadialGradient(cxw, cyw, 0, cxw, cyw, r);
    g.addColorStop(0, `rgba(${wsp.rgb}, 0.07)`);
    g.addColorStop(1, `rgba(${wsp.rgb}, 0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cxw, cyw, r, 0, Math.PI * 2); ctx.fill();
  }

  const cx = w / 2;
  const cy = h / 2;
  const base = Math.min(w, h);
  const radius = base * 0.3;
  const nodeR = base * 0.055;
  const crownR = base * 0.1;
  const orbitR = radius * 1.38;

  const pos = SEATS.map((_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3;
    return { x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius };
  });

  // Triangle edges
  ctx.strokeStyle = "rgba(255, 255, 255, 0.10)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pos[0].x, pos[0].y);
  ctx.lineTo(pos[1].x, pos[1].y);
  ctx.lineTo(pos[2].x, pos[2].y);
  ctx.closePath();
  ctx.stroke();

  // Beams crown → active seats
  SEATS.forEach((seat, i) => {
    if (!state.activeSeats.includes(seat)) return;
    drawBeam(ctx, cx, cy, pos[i].x, pos[i].y, seatRgb(seat), 0.5);
  });

  // Crown ripple rings
  for (let k = 0; k < 3; k++) {
    const phase = (t * 0.5 + k / 3) % 1;
    const rr = crownR + phase * base * 0.12;
    ctx.strokeStyle = `rgba(${CROWN_RGB}, ${0.3 * (1 - phase)})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke();
  }

  // Crown orb
  drawOrb(ctx, cx, cy, crownR, CROWN_RGB, state.phase === "idle" ? 0.8 : 1);

  // Gemini orbit ring + satellite
  ctx.strokeStyle = "rgba(16, 185, 129, 0.10)";
  ctx.setLineDash([2, 6]);
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, orbitR, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);

  const speed = state.needsVisual ? 1.6 : 0.45;
  const ga = t * speed;
  const gx = cx + Math.cos(ga) * orbitR;
  const gy = cy + Math.sin(ga) * orbitR;

  ctx.save();
  ctx.shadowBlur = state.needsVisual ? 16 : 8;
  ctx.shadowColor = "rgba(16, 185, 129, 0.8)";
  ctx.strokeStyle = `rgba(16, 185, 129, ${state.needsVisual ? 0.5 : 0.18})`;
  ctx.lineWidth = state.needsVisual ? 3 : 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, orbitR, ga - 0.9, ga);
  ctx.stroke();
  ctx.restore();

  drawOrb(ctx, gx, gy, nodeR * 0.72, seatRgb("visual"), state.needsVisual ? 1 : 0.55);

  // Trinity orbs
  SEATS.forEach((seat, i) => {
    const active = state.activeSeats.includes(seat);
    drawOrb(ctx, pos[i].x, pos[i].y, nodeR, seatRgb(seat), active ? 1 : 0.4);
  });

  // Correction ribbons
  for (const corr of state.corrections) {
    const fi = SEATS.indexOf(corr.from);
    const ti = SEATS.indexOf(corr.to);
    if (fi === -1 || ti === -1) continue;
    drawRibbon(ctx, pos[fi].x, pos[fi].y, pos[ti].x, pos[ti].y, t, corr.status);
  }
}

export function SovereignCanvas({ state }: { state: CanvasState }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let raf = 0;
    let t = 0;
    let last = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      render(ctx, w, h, t, stateRef.current);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full"
      aria-hidden="true"
    />
  );
}