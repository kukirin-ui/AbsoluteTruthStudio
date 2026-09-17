import { createFileRoute } from "@tanstack/react-router";
import { StudioApp } from "@/components/studio/studio-app";
import { StudioGuard } from "@/lib/error-component";

type Search = { s?: string; ref?: string };

export const Route = createFileRoute("/")({
  validateSearch: (raw: Record<string, unknown>): Search => ({
    s: typeof raw.s === "string" ? raw.s : undefined,
    ref: typeof raw.ref === "string" ? raw.ref : undefined,
  }),
  component: Home,
});

function Home() {
  const { s, ref } = Route.useSearch();
  return (
    <StudioGuard>
      <StudioApp shareParam={s} refCode={ref} />
    </StudioGuard>
  );
}
