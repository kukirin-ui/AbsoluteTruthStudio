import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/owner")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { code?: string };
        try {
          body = (await request.json()) as { code?: string };
        } catch {
          return Response.json({ ok: false, error: "Invalid request" }, { status: 400 });
        }
        const expected = (process.env.OWNER_CODE || "ATS-OWNER").trim();
        const got = (body.code ?? "").trim();
        if (!got || got.toUpperCase() !== expected.toUpperCase()) {
          return Response.json({ ok: false, error: "Wrong owner code." }, { status: 401 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
