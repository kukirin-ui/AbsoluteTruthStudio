# Absolute Truth Studio

A TanStack Start app: four-seat AI mesh (Architecture / Visual / Coder /
Verifier), 8 model providers with BYOK support, credit-based billing via
Stripe, Postgres (Neon) via Better Auth. See `.env.example` for every
environment variable the app reads.

Key source locations:
- `src/lib/providers.ts` — mesh provider routing (endpoints, auth headers, payload shaping)
- `src/lib/tiers.ts` / `src/lib/engine.ts` — plan tiers, model catalog, ceiling clamping
- `src/lib/catalog.ts` — the agent/plugin catalog (kind: "agent" vs kind: "tool" — keep them separate)
- `src/lib/auth/` — Better Auth setup; `server.ts` is server-only, never import it from client code
- `src/routes/api/mesh.ts` — the main chat/build endpoint

No proprietary build-platform conventions apply here — this is a plain Vite +
TanStack Start project. `npm run dev` / `npm run build` work as expected.
