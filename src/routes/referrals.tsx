import { createFileRoute, redirect } from "@tanstack/react-router";

// Referrals were retired — they never fit an elite, credits/BYOK product.
// Anyone landing on the old path is sent to the studio.
export const Route = createFileRoute("/referrals")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
