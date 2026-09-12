const TALK = [
  "Review this architecture: what breaks first under 10× traffic?",
  "Debug this stack trace — root cause and smallest safe fix?",
  "UI audit: which flows fail accessibility and mobile density?",
  "Security pass: what would you block before this ships to prod?",
  "How should a four-agent mesh divide an API design review?",
  "How does Stripe Billing differ from one-off Payment Links?",
  "What should a first-time founder check before charging €19/month?",
  "Explain vector vs raster for a logo that has to live on a 16:9 ad.",
  "What is a PWA versus a Play Store listing for a web studio?",
  "What is actually known about lithium battery range in cold weather?",
  "Is OLED or mini-LED better for a bright living room in 2026?",
  "How does a heat pump save money versus a gas boiler, with numbers?",
  "Which claims about creatine are backed by trials, and which are not?",
  "What is empirically known about sleep and caffeine after 2pm?",
  "What is actually known about how honey lasts for years?",
];

const BUILD = [
  "Architecture review brief for a TanStack + Vite workbench — constraints and sequence.",
  "Full booking app — calendar, guests, and a working mock backend.",
  "Working habit tracker app with streaks stored on this device.",
  "Inventory app: add SKU, count, and a low-stock list that persists.",
  "Recipe box app — search, save, and a shopping list that persists.",
  "Full CRM lite: contacts, notes, and a pipeline board on this device.",
  "Field notes app with tags, search, and local persistence.",
  "Glass indigo studio poster at night, 16:9 still, empty chair, one LED.",
  "Still of a matte black mechanical keyboard, 3/4 view, cool rim light.",
  "16:9 poster of a citrus grove at blue hour, no type, no figures.",
  "10-second product spin of a ceramic pour-over kettle, white seamless.",
  "30-second cinematic water-brand ad, 16:9, one bottle, no extra logos.",
  "9:16 10-second rain on a black coffee cup, no people.",
  "20-second night-drive clip of a single city tram, same tram throughout.",
  "Security checklist UI for a four-seat mesh — flags, severity, keep-answer.",
];

function rotate(pool: string[], visit: number) {
  const start = (visit * 3) % pool.length;
  return [0, 1, 2].map((i) => pool[(start + i) % pool.length]!);
}

export function starterPrompts(mode: "talk" | "build"): string[] {
  const pool = mode === "talk" ? TALK : BUILD;
  if (typeof sessionStorage === "undefined") return pool.slice(0, 3);
  const key = `ats-starters-${mode}`;
  const n = Number(sessionStorage.getItem(key) || "0") || 0;
  sessionStorage.setItem(key, String(n + 1));
  return rotate(pool, n);
}
