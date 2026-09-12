import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/r/$code")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/",
      search: { ref: params.code },
    });
  },
  component: function ReferralRedirect() {
    return null;
  },
});
