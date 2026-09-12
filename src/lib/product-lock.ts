export type ProductLock = {
  subject: string;
  visual: string;
  negatives: string;
  shots: string[];
  full: string;
};

export function localProductLock(prompt: string): ProductLock {
  const named = extractNamedProduct(prompt);
  const subject = named || "the exact subject the user named — do not substitute a similar brand";
  const visual = `${prompt}. Photoreal. Keep the named make and model. Same subject every frame. If a reference photo is attached, that photo IS the product.`;
  const negatives =
    "Do not replace the named product with a lookalike brand. Do not change the subject mid-clip. Do not invent a stand-in.";
  const action = /\b(off[\s-]?road|terrain|dirt|trail|gravel|hill|drive|studio|hero)\b/i.test(prompt)
    ? "Match the action the user named. Photoreal cinematic."
    : "Photoreal, exact product the user named.";
  return finalize(subject, visual, negatives, [`${visual} ${action}`, `${visual} SAME subject. ${action}`]);
}

export function extractNamedProduct(prompt: string) {
  const product = prompt.match(
    /\b([A-Za-z][\w-]*(?:\s+[A-Za-z0-9][\w-]*){0,5})\s+(?:scooter|bike|phone|car|watch|shoe|bag|camera|laptop|console|model)\b/i,
  );
  if (product?.[1]) return product[1].trim();
  const titled = prompt.match(/\b([A-Z][A-Za-z0-9]+(?:[\s-][A-Z0-9][A-Za-z0-9]+){0,4})\b/);
  return titled?.[1]?.trim();
}

export function applyLock(base: string, lock: ProductLock) {
  return `${lock.full} USER BRIEF: ${base}`.slice(0, 1400);
}

export function lockShotPrompt(lock: ProductLock, shot: string, index: number, total: number) {
  return `${lock.full} SHOT ${index + 1} of ${total}. ${shot} SAME exact ${lock.subject} as every other shot. ${lock.negatives}`.slice(
    0,
    1400,
  );
}

export function heroStillPrompt(lock: ProductLock) {
  return `${lock.full} PRODUCT PLATE. Entire subject in frame, three-quarter front, sharp daylight, photoreal catalog photo. If a reference photo exists, match it. ${lock.negatives}`.slice(
    0,
    1200,
  );
}

function finalize(subject: string, visual: string, negatives: string, shots: string[]): ProductLock {
  const full = `LOCKED SUBJECT: ${subject}. ${visual} ${negatives}`.replace(/\s+/g, " ").slice(0, 1100);
  return { subject, visual, negatives, shots, full };
}
