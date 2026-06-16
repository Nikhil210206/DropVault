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
| 4  | Authentication       | ⬜                                        |
| 5  | File Upload System   | ⬜                                        |
| 6  | File Sharing System  | ⬜                                        |
| 7  | Frontend Development | ⬜                                        |
| 8  | Advanced Features    | ⬜                                        |
| 9  | Testing              | ⬜                                        |
| 10 | Docker               | ⬜                                        |
| 11 | CI/CD                | ⬜                                        |
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
| Redis client (cache/RL)      | finite `maxRetriesPerRequest: 3` + `enableOfflineQueue: false` → fail fast; BullMQ gets its own conn (`null`) in Phase 8 | **Locked** |
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
