# ai-fluency-scorer

Internal Phrase application for AI fluency assessment. All ~300 employees self-assess across
four dimensions (Mindset, Strategy, Building, Accountability); Claude scores free-text responses
as a **suggestion only**; a manager confirms the final level in a 1:1. ELT gets an org-wide view.

Built to the spec `2026-06-11_AI-Fluency-App-Spec` (document v1.5). See `CLAUDE.md` for the
load-bearing data-integrity rules and conventions.

## Stack

- **Frontend** — React 18 + TypeScript, Vite, React Router (role-guarded), React Query, Recharts.
- **Backend** — Node 20 + Fastify, Zod, Prisma, Anthropic SDK (server-side only), BullMQ + Redis.
- **DB** — PostgreSQL 15. **Auth** — Okta at the Launchpad ingress gateway (`X-Userinfo` header).
- **Deploy** — single container (Fastify serves the built SPA) → ECR → Helm → EKS.

## Repository layout

```
packages/shared      Enums, AI Fluency Ladder, composite math, Zod scoring contract (shared FE/BE)
apps/api             Fastify API, Prisma schema, scoring service + BullMQ worker, all routes
apps/web             React SPA — Employee / Manager / ELT surfaces
prompts/             scoring-rubric-v{n}.txt (the Claude system prompt; §12.5)
deploy/chart/        Helm chart (Deployment, Service, HTTPRoute+OIDC, HPA, NetworkPolicy)
deploy/*.tfvars      provision-infra request (not yet applied)
.github/workflows/   build.yml (→ ECR) and deploy.yml (→ EKS via Helm)
.phrase-platform/    Platform config consumed by the Launchpad skills
e2e/                 Playwright end-to-end suite (5 critical paths)
```

## Local development

Prerequisites: Node 20+, Docker.

```bash
cp .env.example .env            # dev defaults include AUTH_DEV_BYPASS + a dev identity
npm install                     # if scripts are blocked: npm approve-scripts esbuild prisma @prisma/client @prisma/engines && npm install
npm run infra:up                # Postgres + Redis via docker compose
npm run db:generate && npm run db:migrate
npm run dev                     # API on :3000, web on :5173 (proxies /api → :3000)
```

Set `ANTHROPIC_API_KEY` in `.env` to exercise real scoring. In local dev, `AUTH_DEV_BYPASS=true`
simulates the gateway identity (`AUTH_DEV_EMAIL` / `AUTH_DEV_GROUPS`); it is rejected in production.

## Quality

```bash
npm run typecheck         # tsc across all workspaces
npm run build             # tsup (api) + vite (web)
npm test                  # unit tests (shared + api + web) — vitest, no external services
npm run test:integration  # Prisma integration tests against a real Postgres test DB
npm run test:e2e          # Playwright — 5 critical paths (full stack + mock Anthropic)
```

**Unit tests** mock external services; they cover the scoring service (all failure modes),
the circuit breaker, auth/role resolution, the shared scoring contract, and frontend
components (RoleGuard, the wizard).

**Integration tests** (`apps/api/test/integration`) run the service layer against a real
Postgres database (BullMQ/SMTP mocked) — state transitions, optimistic-lock conflicts, the
composite-from-agreed integrity rule, and org aggregation/CSV anonymisation. Requires a
running Postgres; the suite uses `TEST_DATABASE_URL` (default
`postgresql://localhost:5432/aifluency_test`). Apply the schema first with
`DATABASE_URL=… npx --workspace @ai-fluency/api prisma db push`.

**E2E tests** (`e2e/`) drive the built SPA + API end-to-end with Playwright, covering the
five spec critical paths: full self-assessment, manager calibration, ELT dashboard, scoring
timeout fallback, and manual calibration without AI. Identities are set per test via the
`X-Userinfo` header (no gateway needed); scoring is made deterministic by pointing the
Anthropic SDK at a local mock via `ANTHROPIC_BASE_URL`. Requires Postgres + Redis running and
the Playwright browser (`cd e2e && npx playwright install chromium`). Playwright boots the
mock and the API automatically and migrates/seeds a dedicated `aifluency_e2e` database.

## Deployment (Phrase Launchpad)

1. **provision-infra** — apply `deploy/ai-fluency-scorer.tfvars` (creates repo, namespace, ECR,
   OIDC/IRSA, RDS). **Not yet applied.**
2. **add-secret** — set `ANTHROPIC_API_KEY`, `DATABASE_URL`, `REDIS_URL`, and (optional) `SMTP_*`
   as GitHub Actions secrets on the service repo.
3. Merge to `main` → `build.yml` pushes the image, `deploy.yml` deploys the Helm chart.

### Open items before launch

- **Redis is not provisioned by `provision-infra`.** BullMQ needs a Redis/ElastiCache endpoint —
  arrange one with the platform team and supply it as the `REDIS_URL` deploy secret.
- **Blocking go/no-go gates (spec §10.4)** — Anthropic DPA + zero-retention, GDPR Legitimate
  Interest Assessment, and EU AI Act classification in the AI Register must be signed off by
  DPO/Legal before any employee data flows. Keep `SCORING_ENABLED=false` until then.
