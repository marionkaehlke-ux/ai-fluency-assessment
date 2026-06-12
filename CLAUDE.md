# AI Fluency Scorer — CLAUDE.md

## Purpose

Internal Phrase application for AI fluency assessment. All ~300 employees self-assess
across four dimensions (Mindset, Strategy, Building, Accountability); Claude scores
free-text responses as a suggestion only; a manager confirms the final level in a 1:1.

Deployed on Phrase Launchpad (EKS). Service name: `ai-fluency-scorer`.

**Never expose `ANTHROPIC_API_KEY` or DB credentials in logs, responses, or client-side code.**

---

## Architecture

```
React 18 (Vite) → Fastify API (port 3000) → PostgreSQL 15 (Prisma ORM)
                                           → Redis (BullMQ scoring jobs)
                                           → Anthropic Claude API (server-side only)
```

Claude API is called exclusively from `src/services/scoring.ts` — never from route
handlers and never from the frontend. The React build is served as static files by
Fastify in production.

---

## Scoring system — critical rules

**NEVER** write `aiSuggestedLevel` to `agreedLevel` without `manager_confirmed: true`
in the request body. This is a data-integrity rule, not a UX choice. The API must
reject calibration requests missing this flag.

**NEVER** compute `compositeLevel` from `aiSuggestedLevel` — always from `agreedLevel`.
Composite level is only computed after all four `agreedLevel` values are set.

**ALWAYS** validate Claude output against `scoringSchema` (Zod) before any DB write.
See `src/schemas/scoring.ts`. An out-of-range level (e.g. 5) must never reach the DB.

**ALWAYS** resolve the Claude model string from the `CLAUDE_MODEL` env var — never
hard-code it. The value must be logged with each scoring event in the audit trail.

---

## Data model — key entities

| Entity | Purpose |
|---|---|
| `users` | phrase.com employees; joined to Personio via email; roles: EMPLOYEE / MANAGER / ELT / ADMIN_CALIBRATOR |
| `assessment_cycles` | Named periods (e.g. 2026-H1); created by ADMIN_CALIBRATOR |
| `assessments` | One per user per cycle; status: DRAFT → SELF_SUBMITTED → CALIBRATED → ARCHIVED |
| `dimension_scores` | One row per dimension per assessment; stores response text, aiSuggestedLevel, agreedLevel |
| `audit_log` | Immutable append-only record of all mutations (actor, action, timestamp, before/after) |

**HRIS source of truth:** Personio. Manager hierarchy and `functionArea` are synced from
Personio on login via `phrase.com` email join key. If no match is found, `functionArea`
defaults to `UNASSIGNED`. Google Workspace is auth only — not an org data source.

---

## Naming conventions

| Context | Convention | Example |
|---|---|---|
| Database columns | snake_case | `agreed_level`, `manager_id`, `scoring_failed` |
| TypeScript variables/functions | camelCase | `agreedLevel`, `managerId`, `scoringFailed` |
| TypeScript interfaces/types | PascalCase | `AssessmentRecord`, `DimensionScore` |
| API route paths | kebab-case | `/assessments/:id/dimension-scores` |
| Enum values | SCREAMING_SNAKE_CASE | `SELF_SUBMITTED`, `ADMIN_CALIBRATOR`, `MINDSET` |
| Assessment cycle IDs | YYYY-H{1\|2} | `2026-H1`, `2026-H2` |
| Scoring prompt files | `scoring-rubric-v{n}.txt` | bump version on any rubric change |
| Feature flags | SCREAMING_SNAKE_CASE boolean | `SCORING_ENABLED`, `SLACK_NOTIFICATIONS_ENABLED` |

Assessment status values: `DRAFT | SELF_SUBMITTED | CALIBRATED | ARCHIVED`
(always SCREAMING_SNAKE_CASE in code — never lowercase strings).

---

## Anti-patterns — do not introduce

| Anti-pattern | Why / correct approach |
|---|---|
| `agreedLevel = aiSuggestedLevel` without `manager_confirmed: true` | Bypasses the human-review safeguard. API must reject. |
| Computing `compositeLevel` from `aiSuggestedLevel` | AI scores are provisional. Compute only from human-agreed values. |
| Calling Claude API from the frontend | Exposes `ANTHROPIC_API_KEY` in browser traffic. All Claude calls go through the backend scoring service. |
| Interpolating employee free-text into the system message | Creates a prompt-injection surface. Employee responses go in the user message only. |
| Skipping Zod validation on Claude output | Out-of-range levels corrupt data silently. Always run `scoringSchema.parse()` before any DB write. |
| Writing directly to the DB from a route handler | Bypasses the service layer, audit logging, and optimistic locking. All mutations go through the service layer. |
| Hard-coding the Claude model string | Use `CLAUDE_MODEL` env var so it can be updated without a code change. |
| Using `WidthType.PERCENTAGE` in any docx export | Breaks in Google Docs. Always use `WidthType.DXA`. |

---

## Testing requirements

| Area | Target | Notes |
|---|---|---|
| Scoring service (`src/services/scoring.ts`) | 100% line coverage | Must cover all six failure modes: timeout, malformed JSON, out-of-range level, missing dimension, concurrency lock, circuit-breaker trip |
| API route handlers | 80% line coverage | Happy path + at least one error path per route |
| Auth & role middleware | 100% branch coverage | All three role paths (EMPLOYEE, MANAGER, ELT) and ownerOrManager guard |
| Prisma data model (integration tests) | All state transitions | DRAFT→SELF_SUBMITTED, SELF_SUBMITTED→CALIBRATED, any state→ARCHIVED. Use real test DB, not mocks. |
| Frontend (React) | 60% line coverage | Wizard step transitions, role-based route guards, scoring result display |
| End-to-end (Playwright) | 5 critical paths | Full self-assessment, manager calibration, ELT dashboard load, scoring timeout fallback, manual calibration without AI |

---

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Injected by Launchpad from AWS Secrets Manager |
| `ANTHROPIC_API_KEY` | Yes | Add via `add-secret` skill after deploy |
| `CLAUDE_MODEL` | Yes | e.g. `claude-sonnet-4-5` — pinned, never float |
| `SCORING_PROMPT_VERSION` | Yes | e.g. `v1` — references `prompts/scoring-rubric-v1.txt` |
| `REDIS_URL` | Yes | Injected by Launchpad |
| `PORT` | No | Defaults to `3000` |
| `SCORING_ENABLED` | No | Feature flag — set to `true` in production after shadow-mode gate passes |
| `SLACK_NOTIFICATIONS_ENABLED` | No | Feature flag |

---

## Spec reference

Full technical specification: `2026-06-11_AI-Fluency-App-Spec_v1.5.docx`

Key sections for engineering:
- §4 — User flows and screen states
- §5 — Data model (full entity definitions)
- §6 — API routes (all endpoints, auth, error responses)
- §7 — Scoring service architecture and failure modes
- §8 — Data & security (GDPR, Anthropic DPA, prompt injection controls)
- §10 — Validation and go/no-go criteria
- §12.5 — Scoring rubric (L0–L4 per dimension, with worked examples)

---

## Phrase Platform

This service targets **Phrase Platform** — Kubernetes (Amazon EKS).
All deployments go through GitHub Actions → ECR → Helm → EKS. There is no direct
cluster access.

Platform configuration is in `.phrase-platform/` — platform skills read it automatically.

### Development Guidelines

Follow the **12-Factor App** methodology (https://12factor.net/):

- **Config in env vars** — never hardcode URLs, credentials, or environment-specific values.
  Use environment variables for all configuration. Secrets are managed via GitHub Actions
  secrets and injected as env vars at runtime.
- **Stateless processes** — the app must not rely on local filesystem state between requests.
  Use external backing services for persistence. The platform provides **RDS PostgreSQL**
  as a managed database — connect via `DATABASE_URL` env var (provisioned automatically,
  credentials stored in AWS Secrets Manager). For object/file storage, the platform provides
  **S3 buckets** — bucket names available as GitHub Actions repo variables (`S3_BUCKET_<KEY>`),
  passed to the app as env vars at deploy time. Local disk is ephemeral (`emptyDir` only).
- **Port binding** — export the HTTP service via a port (default to `PORT` env var or `3000`).
  The container will receive traffic on this port.
- **Disposability** — support graceful shutdown (handle SIGTERM). Fast startup improves
  scaling and deployments.
- **Logs as streams** — write logs to stdout/stderr, not to files. The platform collects
  them automatically.
- **Dev/prod parity** — develop against PostgreSQL locally (Docker Compose) to match the
  RDS PostgreSQL instance in production. Use LocalStack or MinIO locally to match S3.
- **Health endpoints** — expose `/healthz` (liveness) and `/readyz` (readiness) endpoints.
  Kubernetes uses these to manage pod lifecycle.

### Container Requirements

- Run as a **non-root user** in the Dockerfile
- Prefer a **read-only root filesystem** where possible
- **Explicitly declare dependencies** — no implicit system packages
- Use **multi-stage builds** to keep images small
- Set `EXPOSE 3000` in Dockerfile

### CI/CD Requirements

- **All GitHub Actions jobs must use the platform's self-hosted runners** — use
  `runs-on: core-arc-ondemand-launchpad`. Do NOT use `ubuntu-latest` or other
  GitHub-hosted runners — they cannot reach internal services (ECR, EKS).
- This applies to every job: build, deploy, test, lint, etc.

### Authentication & Authorization

**Internal app** — Okta handles auth automatically via the ingress gateway.
Do NOT implement login, OAuth, or session management.

- The gateway injects a trusted **`X-Userinfo`** header (base64 JSON) with claims:
  `sub`, `email`, `name`, `given_name`, `family_name`, `groups`
- The `groups` claim requires `groups` in the OIDC scope — verify it is present.
- Decode `X-Userinfo` in a Fastify middleware and map `groups` to app roles
  (EMPLOYEE / MANAGER / ELT / ADMIN_CALIBRATOR).
- Role mapping logic lives in `src/middleware/auth.ts` — not in route handlers.
