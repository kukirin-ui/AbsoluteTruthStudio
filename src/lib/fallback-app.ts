import type { ProjectFile } from "./types";

export function productTitle(prompt: string) {
  if (/book/i.test(prompt) && /ad/i.test(prompt)) return "Ad Bookings";
  if (/book/i.test(prompt)) return "Bookings";
  const cleaned = prompt
    .replace(/^(build|make|create|napravi)\s+(me\s+)?(a\s+|an\s+|the\s+)?/i, "")
    .replace(/\b(full|working|complete|radi\w*)\s+/gi, "")
    .replace(/\b(app|aplikac\w*|for|za)\b/gi, " ")
    .replace(/[—–-].*$/, "")
    .replace(/\s+/g, " ")
    .trim();
  const titled = cleaned
    .split(" ")
    .filter(Boolean)
    .slice(0, 4)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return titled || "Studio App";
}

export function fallbackAppFiles(prompt: string): ProjectFile[] {
  const title = productTitle(prompt);
  return [
    {
      path: "src/lib/data.ts",
      language: "ts",
      content: DATA_TS,
    },
    {
      path: "src/components/Board.tsx",
      language: "tsx",
      content: BOARD_TSX,
    },
    {
      path: "src/App.tsx",
      language: "tsx",
      content: appTsx(title),
    },
  ];
}

export function fallbackConsensus(title: string) {
  return `${title} is running in the preview. Open Board to see every booking, tap a row for the brief, or New booking to save a campaign on this device. Nothing is deferred — this is the app.`;
}

const DATA_TS = `const KEY = "ats-ad-bookings-v1";

export type Campaign = {
  id: string;
  client: string;
  title: string;
  placement: "Feed" | "Stories" | "Search" | "CTV";
  length: number;
  budget: number;
  start: string;
  notes: string;
};

function uid() {
  return "bk_" + Math.random().toString(36).slice(2, 9);
}

export function load(): Campaign[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : seed();
  } catch {
    return seed();
  }
}

export function save(rows: Campaign[]) {
  localStorage.setItem(KEY, JSON.stringify(rows));
  return rows;
}

export function create(input: Omit<Campaign, "id">) {
  const rows = load();
  const next = [{ ...input, id: uid() }, ...rows];
  return save(next)[0];
}

export function update(id: string, patch: Partial<Campaign>) {
  const rows = load().map((r) => (r.id === id ? { ...r, ...patch, id } : r));
  save(rows);
  return rows.find((r) => r.id === id);
}

export function remove(id: string) {
  save(load().filter((r) => r.id !== id));
}

function seed(): Campaign[] {
  const rows: Campaign[] = [
    {
      id: uid(),
      client: "Northglass",
      title: "Night atelier — 16:9",
      placement: "CTV",
      length: 30,
      budget: 4200,
      start: new Date().toISOString().slice(0, 10),
      notes: "Indigo glass, empty chair, one LED pool.",
    },
    {
      id: uid(),
      client: "Mineral Co",
      title: "Summit water hook",
      placement: "Stories",
      length: 6,
      budget: 900,
      start: new Date().toISOString().slice(0, 10),
      notes: "Cold mountain pour, no voiceover.",
    },
  ];
  save(rows);
  return rows;
}
`;

const BOARD_TSX = `import React from "react";
import type { Campaign } from "../lib/data";

export function Board({
  rows,
  onOpen,
  onRemove,
}: {
  rows: Campaign[];
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-10 text-center">
        <p className="text-sm text-slate-300">No bookings yet. Create one — it stays on this device.</p>
      </div>
    );
  }
  return (
    <ul className="grid gap-3">
      {rows.map((row) => (
        <li key={row.id}>
          <button
            type="button"
            onClick={() => onOpen(row.id)}
            className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-left hover:border-indigo-400/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] tracking-[0.18em] text-indigo-300 uppercase">{row.placement} · {row.length}s</p>
                <h3 className="mt-1 text-base font-medium">{row.title}</h3>
                <p className="mt-1 text-sm text-slate-400">{row.client} · {row.start} · \${row.budget}</p>
              </div>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(row.id);
                }}
                className="rounded-full px-2 py-1 text-[11px] text-slate-400 hover:text-rose-300"
              >
                Remove
              </span>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
`;

function appTsx(title: string) {
  return `import React, { useMemo, useState } from "react";
import { Board } from "./components/Board";
import { load, create, remove, type Campaign } from "./lib/data";

const empty = {
  client: "",
  title: "",
  placement: "Feed",
  length: 15,
  budget: 500,
  start: new Date().toISOString().slice(0, 10),
  notes: "",
};

export default function App() {
  const [tab, setTab] = useState("board");
  const [rows, setRows] = useState(() => load());
  const [openId, setOpenId] = useState(null);
  const [form, setForm] = useState(empty);
  const open = useMemo(() => rows.find((r) => r.id === openId) || null, [rows, openId]);

  function refresh() {
    setRows(load());
  }

  function submit(e) {
    e.preventDefault();
    if (!form.client.trim() || !form.title.trim()) return;
    create({
      client: form.client.trim(),
      title: form.title.trim(),
      placement: form.placement,
      length: Number(form.length) || 15,
      budget: Number(form.budget) || 0,
      start: form.start,
      notes: form.notes.trim(),
    });
    setForm(empty);
    refresh();
    setTab("board");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div>
          <p className="text-[10px] tracking-[0.2em] text-indigo-300 uppercase">Live app</p>
          <h1 className="text-lg font-semibold">${title.replace(/`/g, "")}</h1>
        </div>
        <nav className="flex gap-1 rounded-full bg-white/5 p-1">
          <button type="button" onClick={() => { setTab("board"); setOpenId(null); }} className={tab === "board" && !open ? "rounded-full bg-indigo-500 px-3 py-1.5 text-sm" : "rounded-full px-3 py-1.5 text-sm text-slate-300"}>Board</button>
          <button type="button" onClick={() => { setTab("new"); setOpenId(null); }} className={tab === "new" ? "rounded-full bg-indigo-500 px-3 py-1.5 text-sm" : "rounded-full px-3 py-1.5 text-sm text-slate-300"}>New booking</button>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl space-y-4 px-5 py-6">
        {open ? (
          <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-[10px] tracking-[0.18em] text-indigo-300 uppercase">{open.placement} · {open.length}s</p>
            <h2 className="mt-2 text-xl font-semibold">{open.title}</h2>
            <p className="mt-1 text-sm text-slate-300">{open.client} · starts {open.start} · \${open.budget}</p>
            {open.notes ? <p className="mt-4 text-sm leading-relaxed text-slate-200">{open.notes}</p> : null}
            <button type="button" onClick={() => setOpenId(null)} className="mt-5 rounded-full bg-white/10 px-3 py-1.5 text-sm">Back to board</button>
          </article>
        ) : tab === "new" ? (
          <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-5">
            <label className="grid gap-1 text-sm">Client
              <input value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} className="rounded-lg bg-slate-900 px-3 py-2" required />
            </label>
            <label className="grid gap-1 text-sm">Campaign
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-lg bg-slate-900 px-3 py-2" required />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-sm">Placement
                <select value={form.placement} onChange={(e) => setForm({ ...form, placement: e.target.value })} className="rounded-lg bg-slate-900 px-3 py-2">
                  <option>Feed</option>
                  <option>Stories</option>
                  <option>Search</option>
                  <option>CTV</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm">Length (s)
                <input type="number" min="5" max="60" value={form.length} onChange={(e) => setForm({ ...form, length: e.target.value })} className="rounded-lg bg-slate-900 px-3 py-2" />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-sm">Budget
                <input type="number" min="0" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} className="rounded-lg bg-slate-900 px-3 py-2" />
              </label>
              <label className="grid gap-1 text-sm">Start
                <input type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} className="rounded-lg bg-slate-900 px-3 py-2" />
              </label>
            </div>
            <label className="grid gap-1 text-sm">Notes
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="min-h-20 rounded-lg bg-slate-900 px-3 py-2" />
            </label>
            <button type="submit" className="rounded-full bg-indigo-500 px-4 py-2 text-sm font-medium">Save booking</button>
          </form>
        ) : (
          <Board rows={rows} onOpen={setOpenId} onRemove={(id) => { remove(id); refresh(); }} />
        )}
      </main>
    </div>
  );
}
`;
}