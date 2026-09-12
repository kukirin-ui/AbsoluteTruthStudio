/** Honest cost and host map. Do not invent vendor APIs we do not call. */

export const RENDER_HOSTS = {
  imagine: "xAI Imagine — live on XAI_API_KEY",
  kling: "Kling 3.0 — live only if KLING or FAL keys are on the host; otherwise Imagine 1.5",
  mesh: "Four-seat mesh on Grok 4.5 — live on XAI_API_KEY",
  app: "Local React runtime in the preview — no extra vendor",
} as const;

export const OWNER_COST_LINES = [
  {
    title: "Mesh (every Talk / Build turn)",
    who: "XAI_API_KEY — your quota",
    note: "Grok 4.5 tokens. Cents per turn at typical length. Caps and no retry storms keep this small.",
  },
  {
    title: "Stills",
    who: "XAI_API_KEY — your quota",
    note: "Imagine Image / Image Quality. Cheap relative to video. Pro and Premium include stills; extra packs exist so a visitor cannot drain you.",
  },
  {
    title: "Video (the expensive line)",
    who: "XAI_API_KEY",
    note: "A 10s 720p clip costs far more than a chat turn. Free has no video. Pro is 6 clips to 30s. Premium is 9 clips to 60s. After the included count, the visitor buys a credit pack. The pack price must cover the API burn plus your margin.",
  },
  {
    title: "Optional render plugins",
    who: "Only if you attach them and add host keys",
    note: "Background plugins. Not the default Visual seat. Without extra keys the studio visual host still ships the clip.",
  },
  {
    title: "Stripe",
    who: "acct_1UEWjK42Bm7XSb7p (Absolute Truth Studio)",
    note: "Pro $19 and Premium $49 Payment Links are live. Stripe takes about 2.9% + $0.30. The rest lands on that account. Stripe is the only payment method.",
  },
];

export const MARGIN_RULES = [
  "Never sell unlimited video inside a subscription. Included clips are a cap. Free has none.",
  "Premium $49: after Stripe fees (~$1.70) the remainder is yours. A small slice (about 5–10% of the list price) should be treated as the operational buffer for mesh + included media. Extra video is credit packs so a heavy user cannot put you negative.",
  "Look packs change the brief. They render on the studio visual host. Do not tell a buyer they are calling another vendor.",
  "Seat names (Claude, ChatGPT, Llama, Gemini) are distinct operating frameworks on the Grok 4.5 mesh. The four seats always talk. They are not four separate vendor invoices.",
];

export function lookPrefix(catalogId: string): string {
  switch (catalogId) {
    case "veo":
    case "veo-cinema":
      return "Photoreal cinematic film look, 35mm spherical, natural light, shallow depth of field, finished commercial grade.";
    case "runway":
      return "Director-controlled continuity. Same subject, wardrobe, and product in every frame. Smooth camera.";
    case "seedance":
      return "Follow-through from the approved still. Preserve product geometry; animate motion only.";
    case "flux":
    case "midjourney-hero":
      return "Art-directed hero still. Clean lighting, usable type, product identity locked.";
    case "ideogram":
      return "Readable type inside the frame. Logo and end-card lettering stay sharp.";
    case "recraft":
      return "Brand-consistent illustration or vector. Flat, usable in UI.";
    case "hailuo":
      return "Sharp short-form clip. Fast motion, punchy end.";
    case "luma":
      return "Smooth product motion, slow orbit or tracking shot.";
    case "pika":
      return "Stylized social clip, 9:16 energy even in 16:9, playful but product-accurate.";
    default:
      return "";
  }
}

export function isLookAdapter(id: string) {
  return Boolean(lookPrefix(id));
}
