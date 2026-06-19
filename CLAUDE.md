# DropVault — Project Guide & Memory

> This file is my working memory for the DropVault build. It is loaded into context each
> session. Keep it current: update the phase tracker and decision log as we go.

## What we're building

DropVault — a production-grade, startup-style SaaS **file-sharing platform** (inspired by
Google Drive / Dropbox / WeTransfer). Portfolio project for a 3rd-year CS student who wants
to **learn while building**. Production-quality code, industry-standard architecture.

## Tech stack (locked)

| Layer        | Choice                                                                                  |
| ------------ | --------------------------------------------------------------------------------------- |
| Frontend     | Next.js 15, React 19, TypeScript, Tailwind, Shadcn UI, TanStack Query, Zustand, RHF, Zod |
| Backend      | Node.js, Express, TypeScript                                                             |
| Database     | PostgreSQL + Prisma ORM                                                                  |
| Cache/Queue  | Redis (cache, sessions, rate-limit, BullMQ queues, Socket.IO adapter)                   |
| Storage      | AWS S3 (presigned URLs, multipart/resumable); **MinIO** locally                         |
| Email        | **Resend** (Mailhog locally)                                                            |
| Auth         | JWT access (short-lived) + rotating refresh token in httpOnly secure cookie             |
| Realtime     | Socket.IO (Redis adapter)                                                               |
| API docs     | Swagger / OpenAPI                                                                       |
| Deploy       | Docker + Compose, GitHub Actions, Vercel (web), **Render** (api + worker)                |
| Observability| Winston logging, request logging, error tracking                                        |

## How the user works with me

- Build **incrementally, one phase at a time**. Finish a phase, then **WAIT for approval** (`NEXT`).
- **Complete files only** — file path first, then the whole file. No snippets, no `TODO`, no
  pseudo-code, no omitted imports. Strict TS, ESLint + Prettier.
- **Explain architectural decisions and tradeoffs** — he's learning.
- macOS terminal commands. Latest stable versions.

### Command words

`START` → begin Phase 1 · `NEXT` → next phase · `GENERATE FILE` → full file ·
`REVIEW` → senior review (bugs/security/scale/perf/quality) · `OPTIMIZE` → refactor ·
`INTERVIEW` → placement interview questions.

## Phase tracker

| #  | Phase                | Status                                  |
| -- | -------------------- | --------------------------------------- |
| 1  | Architecture         | ✅ Approved (hardened after review)      |
| 2  | Database Design      | ✅ Approved (schema + raw-SQL migration)  |
| 3  | Backend Setup        | ✅ Complete & verified — migration applied, seeded, /health/ready=200 (db+redis up) |
| 4  | Authentication       | ✅ Complete & verified — 10/10 tests + 13/13 e2e (register→verify→login→refresh/reuse→reset) |
| 5  | File Upload System   | ✅ Complete & verified — 25/25 e2e (multipart→MinIO, download integrity, quota, resume, folders) |
| 6  | File Sharing System  | ✅ Complete & verified — 18/18 e2e (public/password/one-time-atomic/capped/folder/revoke) |
| 7  | Frontend Development | ✅ Complete & verified — `next build` passes (7 routes), typecheck+lint 3/3, prod server serves |
| 8  | Advanced Features    | ✅ Complete & verified — 12/12 e2e (scan gate, thumbnails, realtime, cache) + cleanup job |
| 9  | Testing              | ✅ Complete & verified — 29 tests (api 24 + web 5), isolated test DB, all green |
| 10 | Docker               | ✅ Complete & verified — api+web images build & run (api /health/ready 200, web serves) |
| 11 | CI/CD                | ✅ Complete & verified — ci.yml + cd.yml pass actionlint (0 findings) |
| 12 | Deployment           | ⬜                                        |

## Decision log

| Decision                     | Choice / Default (rationale)                                              | Status   |
| ---------------------------- | ------------------------------------------------------------------------- | -------- |
| Resumable uploads            | S3 Multipart Upload API + presigned part URLs + UploadSession tracking   | Proposed |
| Background jobs              | BullMQ on Redis (thumbnails, scan, cleanup)                              | Proposed |
| Password hashing             | argon2id                                                                  | Proposed |
| Refresh tokens               | Rotation + reuse detection, stored hashed, httpOnly cookie               | Proposed |
| Search (v1)                  | Postgres FTS / trigram; Meilisearch later if needed                      | Proposed |
| Soft deletes + cleanup       | `deletedAt` columns + scheduled purge job                                | Proposed |
| Malware scan                 | ClamAV via queue; file stays QUARANTINED until clean                     | Proposed |
| Repo layout                  | Turborepo monorepo (shared Zod DTOs in packages/shared)                  | **Locked** |
| Backend hosting              | Render (api + worker services, managed Postgres + Redis)                 | **Locked** |
| Email                        | Resend (prod), Mailhog (local)                                           | **Locked** |
| Local object storage         | MinIO container; real AWS S3 in staging/prod                             | **Locked** |
| **Hardening (from review)**  | Folded P0/P1 into docs/ARCHITECTURE.md §6/§7/§12/§13                      | **Locked** |
| Content serving              | Cookieless content domain via CloudFront; attachment + nosniff + sandbox CSP | Locked |
| Worker sandbox               | No egress, dropped caps, RO FS, CPU/mem/time limits, decode-bomb guards  | Locked |
| Upload integrity             | Presigned PUT size/type-bound + HEAD-verify before READY                 | Locked |
| Quota                        | Reservation model (storageReserved + UploadSession.reservedBytes)        | Locked |
| Share limits                 | Atomic conditional UPDATE, never cache-gated                             | Locked |
| Multipart parts              | `upload_parts` table (not JSONB array)                                   | Locked |
| PKs                          | UUIDv7 (time-ordered, B-tree locality)                                   | Locked |
| JWT signing                  | Asymmetric EdDSA/RS256 + kid rotation                                    | Locked |
| DB pooling                   | PgBouncer transaction mode; capped Prisma pool                           | Locked |
| Migrations                   | Expand/contract; gated job w/ advisory lock; --create-only for raw SQL   | Locked |
| Backups/DR                   | Postgres PITR + rehearsed restore; S3 Versioning                         | Locked |
| Observability                | Sentry + OpenTelemetry + dead-letter + stuck-file sweeper                | Locked |
| CI AWS auth                  | GitHub OIDC assume-role (no static keys)                                 | Locked |
| Quota model                  | Flat 10 GiB/user default for v1 (tiers/billing = P2 roadmap)             | **Locked** |
| Folder delete                | Soft-delete via app logic; `parentId onDelete: Cascade` as purge safety net | **Locked** |
| Redis client (cache/RL)      | `maxRetriesPerRequest: 3` + `commandTimeout: 1000ms` → fail fast w/o startup race; BullMQ gets its own conn (`null`) in Phase 8 | **Locked** |
| Rate-limiter keys            | distinct Redis prefix per limiter (`rl:global:`, `rl:auth:`) so independent limits never share a counter | **Locked** |
| Auth: JWT                    | EdDSA (Ed25519) via `jose`, `kid` header; 15m access TTL; keys = base64 PEM in env | **Locked** |
| Auth: refresh                | random 256-bit token, sha256-hashed in DB, httpOnly cookie scoped to `/api/v1/auth`; rotation + family reuse-detection; SameSite none(prod)/lax(dev) + verifyOrigin CSRF guard | **Locked** |
| Auth: passwords              | argon2id; login timing-equalized vs dummy hash; uniform "invalid email or password" | **Locked** |
| Auth: email                  | Mailer interface — nodemailer→Mailpit (local), Resend (prod); verify (24h) + reset (1h) tokens, sha256-hashed | **Locked** |
| Enumeration                  | forgot-password always 200; login uniform; register returns 409 (accepted tradeoff) | **Locked** |
| Validation                   | `validate()` middleware; body/params mutated, query → `req.validatedQuery` (Express 5 query is read-only) | **Locked** |
| Testing                      | Vitest (unit: argon2/jwt/tokens) + supertest integration (live DB) flow test; full test-DB isolation deferred to Phase 9 | **Locked** |
| Uploads: model               | S3/MinIO **multipart**, presigned UploadPart URLs (browser→S3 direct); **S3 ListParts is source of truth** for resume/complete | **Locked** |
| Uploads: integrity           | HEAD-verify assembled object size vs declared at complete; reject mismatch (delete + release) | **Locked** |
| Quota                        | atomic reserve(init)/commit(complete)/release(abort) + addUsed(copy)/subUsed(delete) via conditional `$executeRaw` | **Locked** |
| Storage keys                 | `users/{userId}/files/{randomUUID}/source` (opaque; not the file's PK) | **Locked** |
| Folder paths                 | materialized `path`; rename/delete rewrite descendants via `left("path", N::int)` (cast — Prisma sends numbers as bigint) | **Locked** |
| File delete                  | soft-delete + quota subUsed; S3 object retained for trash (purge job in Phase 8) | **Locked** |
| Listing                      | cursor pagination by `id desc` (uuid v7 ≈ time order); search via `contains` insensitive (trigram GIN) | **Locked** |
| Shares: token                | 128-bit base64url, `@unique`; URL `${WEB_URL}/s/{token}`; all PUBLIC link-based (user-scoped PRIVATE = roadmap) | **Locked** |
| Shares: limits               | atomic conditional UPDATE consumes a download (revoked/expired/allowDownload/maxDownloads checked in one statement) — race-safe one-time | **Locked** |
| Shares: oneTime              | sugar for maxDownloads=1 at creation | **Locked** |
| Shares: password             | argon2id; resolve hides filename until verified; `POST /verify` → short-lived EdDSA **grant** (aud `dropvault-share`, 15m); download requires grant | **Locked** |
| Shares: routes               | owner routes authenticated; resolve/verify/download are PUBLIC (token is the secret); verify rate-limited 10/min | **Locked** |
| Shares: folder               | resolve lists subtree files; download takes `?fileId=` validated within the shared folder's path subtree | **Locked** |
| **Web stack**                | Next 15 (App Router) + React 19 + Tailwind 3.4 + hand-authored shadcn primitives + TanStack Query + Zustand + RHF + next-themes + sonner | **Locked** |
| Web: auth/session            | access token in memory (Zustand, never localStorage); restored on load via refresh cookie; api-client refreshes once on 401 then retries | **Locked** |
| Web: upload                  | resumable multipart client (XHR per part for progress) straight to S3; Zustand upload store + floating progress manager | **Locked** |
| Web: shared types            | Next `transpilePackages: ['@dropvault/shared']`; forms reuse the shared Zod schemas via `@hookform/resolvers` | **Locked** |
| Web: build note              | no `next/font` (avoids build-time font fetch); dark mode via `next-themes` class strategy | **Locked** |
| Web: run                     | `pnpm --filter @dropvault/web dev` on :3000; needs API on :4000 (CORS already allows localhost:3000 + credentials) | **Locked** |
| Queues                       | BullMQ (`scan`/`thumbnail`/`cleanup`); own conn options (`maxRetriesPerRequest: null`); separate `worker.ts` process (`pnpm --filter api worker`) | **Locked** |
| Scan gate                    | `SCAN_ENABLED` → complete sets SCANNING + enqueues scan; clean→READY(+thumb), infected→QUARANTINED (delete obj + refund quota) | **Locked** |
| Scanner                      | pluggable: `SCAN_PROVIDER=clamav` (clamd INSTREAM over TCP, prod) or `eicar` (local stub; **no arm64 ClamAV image**) | **Locked** |
| Thumbnails                   | sharp → 400px WebP for `image/*`, after scan passes; worker must be sandboxed in prod (untrusted media) | **Locked** |
| Realtime                     | Socket.IO + Redis adapter on API; worker emits via `@socket.io/redis-emitter` to `user:{id}` room (`file:updated`) | **Locked** |
| Caching                      | cache-aside `cache.service` (best-effort); share-resolution cached 60s, invalidated on revoke | **Locked** |
| Cleanup                      | hourly repeatable BullMQ job: expire stale upload sessions (+release), fail stuck files (>1h), purge soft-deleted (>30d) | **Locked** |

| Testing infra                | Vitest; isolated **`dropvault_test`** DB + **Redis logical DB 1**; globalSetup creates+migrates (uses `pg`); `resetDb()` truncates + flushdb `beforeEach` | **Locked** |
| Test env                     | `apps/api/.env.test` (gitignored) overrides DB/Redis/SCAN_ENABLED=false/RATE_LIMIT_MAX; derived from `.env`; CI must supply it | **Locked** |
| Test coverage                | api: auth, folders, shares, quota (integration via supertest on test DB) + scanner/crypto (unit); web: utils + Button (RTL/jsdom) | **Locked** |
| Email                        | verification/reset emails are **best-effort** (logged, never block signup/reset) | **Locked** |
| Run tests                    | `pnpm test` (turbo) — needs Postgres+Redis up; api globalSetup auto-creates the test DB | **Locked** |

| Docker: web                  | `docker/Dockerfile.web` — multi-stage, **Next `output: standalone`** (slim ~455 MB); `NEXT_PUBLIC_API_URL` is a build ARG | **Locked** |
| Docker: api                  | `docker/Dockerfile.api` — multi-stage; build bundles via tsup + `prisma generate`; one image runs server OR worker (command override) | **Locked** |
| Docker: api size             | ~1.78 GB (runner copies whole built workspace for reliability). **Slim follow-up**: `pnpm deploy --prod` / prune devDeps (mind the generated Prisma client) | **Known** |
| Docker: prod compose         | `docker/docker-compose.prod.yml` builds api/worker/web + Postgres/Redis/MinIO; `migrate` one-shot runs `prisma migrate deploy` before api; needs `docker/.env` with JWT keys | **Locked** |
| Docker: secrets              | `.dockerignore` excludes all `.env*` (no secrets baked in); runtime env via compose/Render | **Locked** |

| CI (`ci.yml`)                | PR+push: `quality` (lint/typecheck/build) · `test` (Postgres+Redis services, ephemeral JWT keys, generated `.env.test`) · `docker` build-check (push only) | **Locked** |
| CD (`cd.yml`)                | push→main: `migrate` (prisma migrate deploy) → `deploy-api` (Render deploy hooks) + `deploy-web` (Vercel CLI) → `smoke` (/health/ready); `environment: production` gate | **Locked** |
| CD secrets needed            | `DATABASE_URL`/`DIRECT_URL`, `RENDER_DEPLOY_HOOK_API`/`_WORKER`, `VERCEL_TOKEN`/`_ORG_ID`/`_PROJECT_ID`, `PRODUCTION_API_URL` | **Reference** |
| Verified via                 | `actionlint` (Docker) — 0 findings on both workflows | **Locked** |

| **UI design system**         | **Enterprise / restrained** (Linear/Stripe/Dropbox sensibility): calm neutral palette + single indigo accent, premium spacing, hairline borders, soft layered shadows. **Glass only on the sticky topbar + overlays** (no aurora). `BrandBackdrop` (subtle static glow) only on auth/share pages. HSL tokens w/ `<alpha-value>` | **Locked** |
| UI specifics                 | solid (not gradient) `Button`; file explorer is **list-first (table style) + grid toggle + search** with loading/empty/error states; subtle type-tinted icons (`lib/file-visual.ts`); responsive shell (desktop `Sidebar`, mobile `MobileNav` drawer via `Topbar`) | **Locked** |

### Running the full stack locally
`docker compose up -d` → `pnpm --filter @dropvault/api dev` + `pnpm --filter @dropvault/api worker` + `pnpm --filter @dropvault/web dev`. SCAN_ENABLED defaults false in `.env.example` (works without worker); set true to exercise the gate.
| Rate limiting resilience     | `failOpen()` wrapper — Redis outage allows requests (logged), never 500s the API | **Locked** |
| Readiness checks             | `withTimeout(2s)` per dependency so probes report `down` instead of hanging | **Locked** |
| BigInt serialization         | `BigInt.prototype.toJSON` → string (avoid >2^53 precision loss on byte counters) | **Locked** |
| Build tool (api)             | tsx (dev) + tsup (build, bundles @dropvault/shared); ESM, moduleResolution Bundler | **Locked** |

### ⚠️ Local env notes
- **Postgres runs on host port `5433`** (not 5432) — this machine has a native Postgres bound to `127.0.0.1:5432` that shadowed the container. Compose maps `5433:5432`; all `DATABASE_URL`/`DIRECT_URL` use `localhost:5433`. (If you stop the native pg, you can revert to 5432.)
- **Use Node 22** (`.nvmrc`); this machine has Node 20.18 → pnpm prints an engine warning (harmless). `nvm use 22` to silence.
- Prisma 6 warns `package.json#prisma` config is deprecated in Prisma 7 — fine on 6; migrate to `prisma.config.ts` if/when bumping.
- ✅ Migration `20260616150247_init` applied (incl. the 5 raw-SQL objects), seed run (admin@/demo@dropvault.local, pwd `Password123!`), `/health/ready` = 200 with db+redis up, Redis-backed rate-limit headers confirmed.
- The init migration's raw SQL lives in `prisma/migrations/20260616150247_init/migration.sql` — re-applied automatically via `prisma migrate deploy` in CI/prod.

## Resolved decisions (2026-06-16)

1. **Repo layout** → Turborepo monorepo (`apps/web`, `apps/api`, `packages/shared`).
2. **Backend hosting** → Render (api web service + worker service; managed Postgres + Redis).
3. **Email provider** → Resend (Mailhog locally).
4. **Local storage** → MinIO (S3-compatible) in docker-compose; real AWS S3 for staging/prod.

## Conventions (to apply once coding starts)

- API versioned under `/api/v1`. Consistent error envelope. Cursor-based pagination.
- Clean architecture: routes → controllers → services → repositories. DI where it pays off.
- Zod schemas as the single source of truth for validation + inferred types (shared pkg if monorepo).
- All secrets via env / secrets manager — never committed.
