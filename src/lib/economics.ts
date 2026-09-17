/** Look-pack prompt prefixes for seated visual adapters. */

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
