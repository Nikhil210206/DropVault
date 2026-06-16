# DropVault — System Architecture

> Phase 1 deliverable, **hardened after the Staff/Security/DevOps review** (P0/P1 fixes folded in).
> Locked decisions: **Turborepo monorepo · Render (api + worker) · Resend email · MinIO local storage**.

## 0. Architecture philosophy & key bets

1. **Browser uploads/downloads go directly to S3 via presigned URLs — never through our API.**
   The Node server issues signed permissions and records metadata; it never proxies bytes.
2. **The API is fully stateless.** Shared state (sessions, rate-limit counters, cache, queues, ws
   fan-out) lives in Redis/Postgres, so we run N identical API containers.
3. **Heavy work is asynchronous.** Thumbnails, virus scanning, analytics, cleanup run as jobs on a
   Redis-backed queue processed by a separate, sandboxed worker.
4. **Untrusted bytes are treated as hostile** end-to-end: served from a cookieless domain, processed
   in a locked-down worker, verified before they become visible.

---

## 1. High-Level Architecture (HLD)

```
                                  ┌──────────────────────────────┐
                                  │            Clients            │
                                  │   Browser (Next.js web app)   │
                                  └───────────────┬──────────────┘
                                                  │ HTTPS
        ┌─────────────────┬───────────────────────┼───────────────────────┬──────────────────┐
        ▼                 ▼                        ▼                       ▼                  ▼
┌──────────────┐  ┌──────────────┐      ┌────────────────────┐   ┌────────────────┐  ┌──────────────┐
│ Vercel (Edge)│  │  CloudFront  │      │  Render: API (LB)  │   │   AWS S3       │  │ content CDN  │
│ Next.js SSR/ │  │ signed URLs/ │/api  │ Express (stateless)│   │ private bucket │  │ cookieless   │
│ RSC + static │  │ cookies      │─────▶│                    │   │ + Versioning   │  │ download/view│
└──────────────┘  └──────┬───────┘      └─────────┬──────────┘   └───────┬────────┘  └──────┬───────┘
                         │ origin-access            │   ▲                 │  direct PUT/GET   │
                         └──────────────────────────┘   │                 │  (browser↔S3)     │
                                                         │                 └───────────────────┘
        ┌────────────────────────────────────────────────┴───────────────┐
        │                  Stateful backing services (Render)              │
        │  ┌────────────┐  ┌──────────┐  ┌──────────────┐  ┌────────────┐ │
        │  │ PgBouncer  │──│ Postgres │  │    Redis      │  │  Worker    │ │
        │  │ (txn pool) │  │ + PITR   │  │ cache/queue/  │  │ (sandboxed)│ │
        │  └────────────┘  │ backups  │  │ rate-limit/ws │  │ scan+thumb │ │
        │                  └──────────┘  └──────────────┘  └─────┬──────┘ │
        └──────────────────────────────────────────────────────────┼──────┘
                                                                    ▼
                                                ┌───────────────────────────────┐
                                                │ ClamAV · Resend · Sentry · OTel │
                                                └───────────────────────────────┘
```

**Request flows:**
- **Auth/metadata** → Vercel → PgBouncer→Postgres / Redis cache → response.
- **Upload** → API issues presigned multipart URLs **bound to a size range + content-type** → browser
  PUTs chunks straight to S3 → "complete" → API **HEAD-verifies the object**, then creates the `files`
  row in `SCANNING` and enqueues scan+thumbnail jobs → worker clears it to `READY` → client notified.
- **Download/preview** → API verifies ownership/share, issues short-lived **CloudFront signed URL** (or
  S3 presigned GET) on a **cookieless content domain** with `Content-Disposition: attachment`.
- **Public share** → recipient hits `/s/:token` → API atomically checks token/password/expiry/limit →
  issues a scoped, short-TTL download URL.

---

## 2. Low-Level Architecture (LLD)

Clean / layered architecture, one-directional dependencies:

```
ROUTE        URL+verb → middleware chain → controller
MIDDLEWARE   helmet · cors(exact-origin) · requestId · logger(redacted) · rateLimit(per-ip+account+global)
             · authenticate(JWT) · authorize(RBAC + ownership) · validate(Zod DTO) · csrf · errorHandler
CONTROLLER   thin: validated input → service → HTTP response. No business logic.
SERVICE      business rules, transactions, atomic counters, cache invalidation, enqueues jobs.
REPOSITORY   the ONLY layer that touches Prisma. Returns domain entities.
DATA/INFRA   PgBouncer→PostgreSQL · Redis · S3 SDK · BullMQ · Resend · ClamAV
```

Repositories isolate Prisma (mockable/swappable); services own transactions and atomic operations;
controllers stay dumb. DI via constructor-injection + factory wiring. Zod DTOs at the edge double as
OpenAPI source and shared FE/BE types (`packages/shared`).

**Module slices:** `auth`, `users`, `folders`, `files`, `uploads`, `shares`, `analytics`.
**Worker:** separate Render service, same code driven by jobs; **always-on (paid)**, sandboxed.

---

## 3. Database Design (PostgreSQL) — hardened

Principles: soft deletes (`deletedAt`); BIGINT byte sizes; hashed secrets; append-only audit/download;
explicit indexes on every FK and filtered/sorted column; **UUIDv7 PKs** (time-ordered → B-tree locality).

Tables: `users`, `refresh_tokens`, `verification_tokens`, `folders`, `files`, `upload_sessions`,
**`upload_parts`** (new), `shares`, `downloads`, `audit_logs`. Full schema lives in
`prisma/schema.prisma`.

**Review fixes baked into the schema:**
- **`upload_parts` table** replaces the JSONB `completedParts` array → no row-rewrite contention, no
  lost updates. (S3 `ListParts` remains the ultimate source of truth for resume.)
- **Quota reservation** — `users.storageReserved` + `upload_sessions.reservedBytes`. Init reserves
  bytes atomically (`storageUsed + storageReserved + new ≤ quota`); complete commits, abort/expire
  releases. Kills the TOCTOU quota bypass.
- **Partial unique indexes** (`WHERE "deletedAt" IS NULL`) on `users.email` and on
  `folders(userId, parentId, name)` → soft-deleted rows don't block re-use. Added via raw-SQL migration
  (Prisma can't express partial indexes declaratively).
- **Atomic share limits** — `downloadCount`/`maxDownloads`/`oneTime` enforced by a conditional
  `UPDATE ... WHERE downloadCount < maxDownloads RETURNING`, never via cache.
- **XOR target** on `shares` — `CHECK (num_nonnulls("fileId","folderId") = 1)` (raw-SQL).
- **`files.version`** has a defined meaning (current version counter for storage-key pathing); full
  history (`file_versions`) is an explicit roadmap item, not an orphan column.
- **Partition plan** — `downloads` and `audit_logs` are designed for monthly RANGE partitioning;
  decision recorded now (introduce via `pg_partman` when volume warrants).
- **Search** — `pg_trgm` GIN index on `files.name` (raw-SQL); migrate to Meilisearch/OpenSearch later.

ER diagram and the complete Prisma schema are produced in Phase 2.

---

## 4. API Design

- Versioned base `/api/v1`, JSON only. Access token (JWT ~15m, **asymmetric EdDSA/RS256 with `kid`**)
  via `Authorization: Bearer`; refresh token in `httpOnly; Secure; SameSite` cookie; `/auth/refresh`
  rotates it with reuse detection.
- Error envelope `{ "error": { "code", "message", "details", "requestId" } }`.
- Cursor pagination; `Idempotency-Key` on unsafe creates; `X-Request-Id` + `X-RateLimit-*` headers.
- Auth flows give **uniform responses** (no account enumeration); password change/reset **revokes all
  refresh-token families**.

| Module | Endpoints |
| --- | --- |
| Auth | `POST /auth/register · /login · /refresh · /logout · /verify-email · /forgot-password · /reset-password`; `GET /auth/me` |
| Users | `GET/PATCH /users/me`; `POST /users/me/avatar`; `GET /users/me/storage`; `GET/DELETE /users/me/sessions[/:id]` |
| Folders | `POST /folders`; `GET /folders/:id`; `PATCH /folders/:id`; `DELETE /folders/:id`; `GET /folders/:id/children` |
| Files | `GET /files`; `GET /files/:id`; `PATCH /files/:id`; `POST /files/:id/copy`; `DELETE /files/:id`; `GET /files/:id/download`; `GET /files/:id/preview` |
| Uploads | `POST /uploads`; `GET /uploads/:id`; `POST /uploads/:id/parts`; `POST /uploads/:id/complete`; `DELETE /uploads/:id` |
| Shares | `POST /shares`; `GET /shares`; `DELETE /shares/:id`; `GET /shares/:token`; `POST /shares/:token/verify`; `GET /shares/:token/download` |
| Analytics | `GET /analytics/overview`; `GET /files/:id/analytics` |
| Health | `GET /health` (liveness, no deps); `GET /health/ready` (checks DB/Redis/S3) |

---

## 5. Folder Structure (Turborepo monorepo)

```
dropvault/
├── apps/
│   ├── web/   src/{app,components,features,hooks,services,stores,lib,types,utils}/
│   └── api/   src/{modules,middleware,config,jobs,queues,utils,types,docs,tests}/  app.ts server.ts worker.ts
├── packages/{shared (Zod DTOs+types), config-eslint, config-ts}/
├── prisma/   schema.prisma, migrations/, seed.ts
├── docker/   Dockerfile.web, Dockerfile.api, docker-compose.yml
├── .github/workflows/  ci.yml, cd.yml
├── docs/     ARCHITECTURE.md, ADRs
└── turbo.json  pnpm-workspace.yaml  package.json
```

---

## 6. Security Architecture (defense in depth) — hardened

- **Content isolation (P0):** all user files served from a **separate cookieless domain** via
  CloudFront; downloads forced to `Content-Disposition: attachment`; `X-Content-Type-Options: nosniff`;
  inline previews under a strict sandboxed CSP. SVG/HTML never rendered inline on the app origin →
  closes the stored-XSS → token-theft path.
- **Untrusted-media worker (P0):** sandboxed — no network egress, dropped capabilities, read-only FS,
  CPU/memory/time limits, per-job timeouts, decompression-bomb guards before decode; `sharp`/`ffmpeg`/
  ClamAV kept patched. Heavy transcoding may offload to a managed service.
- **Upload integrity (P0):** presigned PUT bound to a `Content-Length` range + content-type; after
  complete, **HEAD the object** to verify real size/type before flipping to `SCANNING`/`READY`.
- **Edge:** HTTPS + HSTS, exact-origin CORS with `Allow-Credentials`, CDN/WAF rate limiting.
- **App:** helmet (CSP, no-sniff, frame-deny); Redis rate limiting layered **per-IP + per-account +
  global** with correct `trust proxy`/XFF handling; CSRF double-submit on cookie routes; Zod validation;
  **log redaction** (auth headers, cookies, `password`, `token`, any `*.amazonaws.com` query string —
  presigned URLs are credentials).
- **AuthN/Z:** argon2id passwords; asymmetric-signed JWT (15m) + rotating refresh with reuse detection;
  RBAC + **centralized resource-ownership checks** (defense against IDOR); optional Postgres RLS later;
  MFA/2FA on the roadmap.
- **Shares:** ≥128-bit random tokens; argon2id + constant-time password check; aggressive verify
  rate-limit/lockout; **atomic** download-limit enforcement.
- **Data:** least-privilege Postgres role; parameterized Prisma; secrets in Render env groups / secrets
  manager (not `.env` in prod); **AWS access via OIDC assume-role**, no static keys; PII retention policy
  on `downloads`/`audit_logs`.
- **Audit:** append-only `audit_logs` for sensitive actions.

---

## 7. AWS / S3 Architecture — hardened

Single **private** bucket (Block Public Access ON), **Versioning ON** (protects against malicious/
accidental delete), SSE at rest, prefix-namespaced:
```
s3://dropvault-{env}/
├── users/{userId}/files/{fileId}/{version}
├── users/{userId}/thumbnails/{fileId}.webp
├── users/{userId}/avatars/{userId}.webp
└── temp/{uploadSessionId}/        # lifecycle: abort incomplete multipart after 1d, expire after 24h
```
**CORS** allows PUT/GET from the web origin. **CloudFront** sits in front with **origin-access** to the
private bucket; public/repeat assets use **signed URLs/cookies** so the CDN actually caches (raw
presigned S3 URLs are per-request and uncacheable). Credentials: MinIO via `.env` locally; prod uses
IAM least-privilege (`PutObject/GetObject/AbortMultipartUpload/ListMultipartUploadParts` on the bucket).

---

## 8. Redis Strategy

| Use | Key pattern | Notes |
| --- | --- | --- |
| Cache (cache-aside) | `cache:file:{id}`, `cache:folder:{id}:children`, `cache:share:{token}` | TTL 60–300s; invalidate on write. **Never** gate quota or share-limits through cache. |
| Atomic counters | `share:{id}:downloads` | atomic limit enforcement for one-time/capped shares |
| Rate limiting | `rl:{scope}:{id}:{route}` | per-IP + per-account + global, sliding window |
| Token control | `revoked:refresh:{jti}` | force-logout denylist |
| Analytics buffer | `q:analytics` | downloads/views enqueued + **batch-inserted async** (off the hot path) |
| Queues (BullMQ) | `bull:{queue}:*` | image-thumb / video-transcode / scan / cleanup — separate queues + priorities |
| WebSocket / SSE fan-out | Socket.IO Redis adapter | server→client "file ready" events (browser already knows its own upload progress) |

Redis is disposable — authoritative data lives in Postgres/S3.

---

## 9. Docker Architecture

**Local `docker-compose.yml`:** postgres, redis, **minio**, **mailhog**, clamav, api, worker, web —
whole stack offline in one command. **Images:** multi-stage (deps→build→runtime), non-root, prod-only
runtime deps, `HEALTHCHECK` + readiness; worker reuses the api image with a different command.
**Prod:** Render builds from Dockerfiles; real S3 + Resend; secrets from Render env groups;
**graceful shutdown** (SIGTERM drains HTTP, in-flight BullMQ jobs, and ws connections).

---

## 10. CI/CD Architecture (GitHub Actions)

**ci.yml (PR & push):** install → lint → typecheck → `prisma validate` → test (vitest unit+integration
on ephemeral postgres/redis; upload/download integration tests also run against a **throwaway real S3
bucket** to catch MinIO↔S3 drift) → build → docker build (no push). Parallelized via Turborepo cache.

**cd.yml (merge to main):** **separate gated migration job** (Prisma takes an advisory lock; uses
**expand/contract, backward-compatible** migrations so old pods survive the window) → deploy api+worker
to Render → deploy web to Vercel → smoke `/health/ready` → notify. **AWS via OIDC assume-role**, secrets
in GitHub Environments, manual approval gate on prod.

**Migration workflow note:** raw-SQL objects (partial unique indexes, `CHECK`, GIN trigram, path index)
are added with `prisma migrate dev --create-only` then hand-edited SQL; never `prisma db push`.

---

## 11. Scalability Considerations

| Concern | Strategy |
| --- | --- |
| Connection exhaustion | **PgBouncer (transaction mode)** in front of Postgres; capped Prisma pool; replicas for analytics later |
| API throughput | stateless containers, horizontal scale behind LB |
| Upload/download bandwidth | offloaded to S3 (direct browser↔S3) |
| Download caching | **CloudFront signed URLs/cookies** for public/repeat assets |
| Hot writes | analytics **batch-inserted async**; `storageUsed` via reservation, not per-op SUM |
| Heavy compute | sandboxed worker tier, **separate queues + priorities** (image vs video), autoscale by depth |
| Big tables | append-only + monthly partitioning; UUIDv7 PKs for index locality |
| Hot reads | Redis cache for metadata + share resolution |
| Real-time | SSE/WS via Socket.IO Redis adapter (API tier only, never Vercel) |
| Search growth | pg_trgm now → Meilisearch/OpenSearch later |
| Cleanup | scheduled jobs purge expired sessions/shares/soft-deletes |

---

## 12. Production Readiness (observability, reliability, DR)

- **Observability:** Sentry (errors), OpenTelemetry traces, RED/USE metrics, structured Winston logs
  with request-id correlation; SLOs + alerts.
- **Job reliability:** BullMQ retries with backoff, **dead-letter queue**, **idempotent** handlers,
  stalled-job recovery; a **stuck-file sweeper** flags/auto-fails files left in `UPLOADING`/`SCANNING`
  past a threshold (so failures never go silent).
- **Health semantics:** liveness has no external deps; readiness checks DB/Redis/S3 so a Redis blip
  doesn't kill every pod.
- **Backups / DR (P0):** Postgres automated backups + **PITR** with a *rehearsed* restore and defined
  RPO/RTO; **S3 Versioning** + lifecycle; documented runbooks.
- **Cost guardrails:** budget alerts on S3 egress, worker compute, Resend volume.

---

## 13. Review findings → remediation roadmap

Full review in chat history; sequencing:

- **P0 (before real users):** cookieless content domain + download hardening; sandboxed worker;
  DB backups/PITR + S3 Versioning + tested restore; atomic share-limit enforcement; presigned
  size/type binding + HEAD verify; log redaction.
- **P1 (before "production-grade"):** PgBouncer + connection budget; expand/contract + gated migration
  job; `upload_parts` + reservation hotspot fixes; observability + dead-letter + stuck-file sweeper +
  graceful shutdown; partial unique indexes; job idempotency/retries.
- **P2 (scale & product depth):** CloudFront signed URLs; reconsider WS↔SSE; partitioning + UUIDv7
  (UUIDv7 already in schema); collaboration ACLs, file versioning, trash lifecycle, MFA, billing tiers;
  OIDC in CI; load testing + cost alerts.

### Deliberate non-goals for v1 (correctly out of scope)
No Kubernetes, no microservices, no event-sourcing, no multi-region, no client-side/zero-knowledge
encryption. A modular monolith + sandboxed worker is the right granularity now.
