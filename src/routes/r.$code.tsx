import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy short links now just open the studio.
export const Route = createFileRoute("/r/$code")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
